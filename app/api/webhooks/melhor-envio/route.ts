import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  getOrderByTrackingCode,
  registerWebhookEvent,
  setOrderFulfillmentByTracking,
  updateWebhookEvent,
} from '@/lib/database'
import {
  extractEvent,
  extractOrderId,
  extractTrackingCode,
  mapMelhorEnvioEventToFulfillment,
  verifyMelhorEnvioSignature,
  type MelhorEnvioPayloadShape,
} from '@/lib/melhor-envio'
import { sendOrderDelivered, sendOrderShipped } from '@/lib/email'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'webhook.melhor-envio' })

export const dynamic = 'force-dynamic'

function buildPayloadHash(payload: string) {
  return crypto.createHash('sha256').update(payload).digest('hex')
}

function buildDeliveryKey(event: string, orderId: string | null, tracking: string | null, payloadHash: string) {
  const idPart = orderId || tracking || 'no-id'
  return `melhorenvio:${event}:${idPart}:${payloadHash.slice(0, 16)}`
}

/**
 * Healthcheck — Melhor Envio cadastra o webhook fazendo uma requisição GET
 * primeiro pra validar que a URL responde. Sem essa rota, o ME rejeita o
 * cadastro com erro genérico de "URL inválida".
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'melhor-envio-webhook' })
}

/**
 * Verifies the request comes from Melhor Envio. ME doesn't sign requests
 * with HMAC like Mercado Pago — it sends the application's Bearer token in
 * the Authorization header. We compare against MELHOR_ENVIO_TOKEN (the same
 * token the storefront uses to call ME's API for shipping quotes).
 *
 * If neither MELHOR_ENVIO_TOKEN nor MELHOR_ENVIO_WEBHOOK_SECRET is
 * configured, we accept-but-ignore (200 with `acked: true`) so the ME panel
 * can save the URL during initial setup. Real payloads without auth still
 * get logged to WebhookEvent for forensics.
 */
function authorizeRequest(request: NextRequest, rawPayload: string): { ok: boolean; reason?: string } {
  const meToken = process.env.MELHOR_ENVIO_TOKEN
  const legacySecret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET || process.env.MELHOR_ENVIO_SECRET

  // Strategy 1 — Bearer token match (preferred, ME's actual behavior).
  const authHeader = request.headers.get('authorization')
  if (meToken && authHeader) {
    const provided = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (provided && provided === meToken.trim()) return { ok: true }
  }

  // Strategy 2 — HMAC header match (legacy, for providers that sign requests).
  const signature =
    request.headers.get('x-signature') ||
    request.headers.get('signature') ||
    request.headers.get('x-hub-signature-256')
  if (legacySecret && signature && verifyMelhorEnvioSignature(legacySecret, signature, rawPayload)) {
    return { ok: true }
  }

  // Strategy 3 — neither configured: accept but flag. Don't 503, ME would
  // think the URL is broken and refuse to register the webhook.
  if (!meToken && !legacySecret) {
    return { ok: false, reason: 'no_auth_configured' }
  }

  return { ok: false, reason: 'invalid_credentials' }
}

export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.text()
    const auth = authorizeRequest(request, rawPayload)

    if (!auth.ok) {
      // Log + 200-acked. ME retries on non-2xx, which would create noise; we'd
      // rather see the orphan event in the WebhookEvent table.
      log.warn({ reason: auth.reason }, 'Melhor Envio webhook unauthorized — acked')
      return NextResponse.json({ acked: true, ignored: true, reason: auth.reason })
    }

    let payload: MelhorEnvioPayloadShape
    try {
      payload = JSON.parse(rawPayload)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const event = extractEvent(payload)
    const orderId = extractOrderId(payload)
    const tracking = extractTrackingCode(payload)
    const payloadHash = buildPayloadHash(rawPayload)
    const deliveryKey = buildDeliveryKey(event, orderId, tracking, payloadHash)
    const signatureHeader =
      request.headers.get('x-signature') ||
      request.headers.get('signature') ||
      request.headers.get('x-hub-signature-256') ||
      request.headers.get('authorization')

    const receipt = await registerWebhookEvent({
      provider: 'melhor-envio',
      deliveryKey,
      topic: event,
      resourceId: orderId || tracking || undefined,
      eventId: orderId || undefined,
      action: event,
      payloadHash,
      signature: signatureHeader,
    })

    if (!receipt.created && receipt.event?.status === 'processed') {
      return NextResponse.json({ received: true, duplicate: true })
    }

    const target = mapMelhorEnvioEventToFulfillment(event)
    if (!target) {
      await updateWebhookEvent(deliveryKey, {
        status: 'ignored',
        processedAt: new Date(),
        lastError: `unmapped_event:${event}`,
      })
      return NextResponse.json({ received: true, ignored: true, event })
    }

    if (!tracking) {
      await updateWebhookEvent(deliveryKey, {
        status: 'failed',
        processedAt: new Date(),
        lastError: 'missing_tracking_code',
      })
      return NextResponse.json({ received: true, error: 'missing_tracking_code' })
    }

    const order = await getOrderByTrackingCode(tracking)
    if (!order) {
      await updateWebhookEvent(deliveryKey, {
        status: 'failed',
        processedAt: new Date(),
        lastError: 'order_not_found',
      })
      // Acknowledge the webhook so ME doesn't retry forever; admin will
      // see the orphan event in the WebhookEvent table.
      return NextResponse.json({ received: true, ignored: true, reason: 'order_not_found' })
    }

    // Avoid regressing fulfillment (e.g. delivered → shipped).
    const ordering: Record<string, number> = {
      pending: 0,
      in_production: 1,
      ready_to_ship: 2,
      shipped: 3,
      delivered: 4,
      cancelled: 99,
    }
    const currentRank = ordering[order.fulfillmentStatus] ?? 0
    const targetRank = ordering[target] ?? 0
    if (target !== 'cancelled' && targetRank < currentRank) {
      await updateWebhookEvent(deliveryKey, {
        status: 'ignored',
        processedAt: new Date(),
        orderNumber: order.orderNumber,
        lastError: `regression_blocked:${order.fulfillmentStatus}->${target}`,
      })
      return NextResponse.json({ received: true, ignored: true, reason: 'regression_blocked' })
    }

    const updated = await setOrderFulfillmentByTracking(tracking, target)
    await updateWebhookEvent(deliveryKey, {
      status: updated.ok ? 'processed' : 'failed',
      processedAt: new Date(),
      orderNumber: order.orderNumber,
      lastError: updated.ok ? null : 'update_failed',
    })

    // Best-effort customer notification on shipped/delivered transitions.
    if (updated.ok && updated.previousStatus !== target) {
      try {
        if (target === 'shipped') {
          await sendOrderShipped(order.customerEmail, order.orderNumber, tracking)
        } else if (target === 'delivered') {
          await sendOrderDelivered(order.customerEmail, order.orderNumber)
        }
      } catch (emailError) {
        captureException(emailError, {
          context: 'webhook.melhor-envio',
          detail: 'customer notification failed',
          orderNumber: order.orderNumber,
          target,
        })
      }
    }

    return NextResponse.json({ received: true, fulfillment: target, orderNumber: order.orderNumber })
  } catch (error) {
    captureException(error, { context: 'webhook.melhor-envio', detail: 'POST handler failed' })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
