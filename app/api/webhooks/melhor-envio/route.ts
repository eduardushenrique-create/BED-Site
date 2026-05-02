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

export const dynamic = 'force-dynamic'

function buildPayloadHash(payload: string) {
  return crypto.createHash('sha256').update(payload).digest('hex')
}

function buildDeliveryKey(event: string, orderId: string | null, tracking: string | null, payloadHash: string) {
  const idPart = orderId || tracking || 'no-id'
  return `melhorenvio:${event}:${idPart}:${payloadHash.slice(0, 16)}`
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET || process.env.MELHOR_ENVIO_SECRET
    if (!secret || !secret.trim()) {
      console.error('[webhook] MELHOR_ENVIO_WEBHOOK_SECRET not configured — rejecting')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 },
      )
    }

    const signature =
      request.headers.get('x-signature') ||
      request.headers.get('signature') ||
      request.headers.get('x-hub-signature-256')
    const rawPayload = await request.text()

    if (!verifyMelhorEnvioSignature(secret, signature, rawPayload)) {
      console.error('[webhook] Invalid Melhor Envio signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
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

    const receipt = await registerWebhookEvent({
      provider: 'melhor-envio',
      deliveryKey,
      topic: event,
      resourceId: orderId || tracking || undefined,
      eventId: orderId || undefined,
      action: event,
      payloadHash,
      signature,
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
