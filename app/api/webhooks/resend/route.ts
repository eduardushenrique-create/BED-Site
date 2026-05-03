import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { registerWebhookEvent, updateWebhookEvent } from '@/lib/database'
import { recordUnsubscribe } from '@/lib/email-unsubscribe'
import {
  extractRecipients,
  shouldOptOut,
  verifyResendSignature,
  type ResendEvent,
} from '@/lib/resend-webhook'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'webhook.resend' })

export const dynamic = 'force-dynamic'

/**
 * Healthcheck — Svix valida o endpoint com GET antes de aceitar registro.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'resend-webhook' })
}

/**
 * POST handler. Fluxo:
 *  1. Le o body cru (assinatura é sobre o texto exato, não JSON normalizado)
 *  2. Valida assinatura Svix se RESEND_WEBHOOK_SECRET está setada (fail-open
 *     com 200+ignored quando não está, pra permitir cadastro inicial)
 *  3. Idempotência via WebhookEvent (mesmo padrão MP/ME — usa svix-id como
 *     chave de delivery)
 *  4. Mapeia bounce-hard/complaint -> recordUnsubscribe (source: 'bounce')
 *  5. Resto é só registrado pra auditoria
 */
export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.text()
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    const secret = process.env.RESEND_WEBHOOK_SECRET || ''
    if (secret) {
      const ok = verifyResendSignature(
        { svixId, svixTimestamp, svixSignature },
        rawPayload,
        secret,
      )
      if (!ok) {
        log.warn({ svixId }, 'Resend webhook rejected — invalid signature')
        return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
      }
    } else {
      // Sem secret configurada: aceita pra permitir cadastro inicial via Svix,
      // mas marca o evento como inseguro pra forensics.
      log.warn('Resend webhook secret missing — accepting unverified payload')
    }

    let event: ResendEvent
    try {
      event = JSON.parse(rawPayload)
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const payloadHash = crypto.createHash('sha256').update(rawPayload).digest('hex')
    const deliveryKey = svixId
      ? `resend:${svixId}`
      : `resend:${event.type}:${payloadHash.slice(0, 24)}`

    const receipt = await registerWebhookEvent({
      provider: 'resend',
      deliveryKey,
      topic: event.type,
      resourceId: event.data?.email_id || undefined,
      eventId: svixId || undefined,
      action: event.type,
      payloadHash,
      signature: svixSignature || undefined,
    })

    if (!receipt.created && receipt.event?.status === 'processed') {
      return NextResponse.json({ received: true, duplicate: true })
    }

    if (!shouldOptOut(event)) {
      await updateWebhookEvent(deliveryKey, {
        status: 'ignored',
        processedAt: new Date(),
        lastError: `unmapped_event:${event.type}`,
      })
      return NextResponse.json({ received: true, ignored: true, type: event.type })
    }

    const recipients = extractRecipients(event)
    if (recipients.length === 0) {
      await updateWebhookEvent(deliveryKey, {
        status: 'failed',
        processedAt: new Date(),
        lastError: 'no_recipients',
      })
      return NextResponse.json({ received: true, error: 'no_recipients' })
    }

    let failures = 0
    for (const email of recipients) {
      try {
        await recordUnsubscribe(email, {
          reason: event.type === 'email.complained' ? 'spam_complaint' : 'hard_bounce',
          source: 'bounce',
        })
      } catch (error) {
        failures += 1
        captureException(error, {
          context: 'webhook.resend',
          detail: 'recordUnsubscribe failed',
          email,
          eventType: event.type,
        })
      }
    }

    await updateWebhookEvent(deliveryKey, {
      status: failures === 0 ? 'processed' : 'failed',
      processedAt: new Date(),
      lastError: failures > 0 ? `partial_failure:${failures}/${recipients.length}` : null,
    })

    log.info(
      { type: event.type, recipientCount: recipients.length, failures },
      'Resend webhook processed',
    )

    return NextResponse.json({
      received: true,
      type: event.type,
      unsubscribed: recipients.length - failures,
      failed: failures,
    })
  } catch (error) {
    captureException(error, { context: 'webhook.resend', detail: 'POST handler failed' })
    return NextResponse.json({ error: 'webhook_processing_failed' }, { status: 500 })
  }
}
