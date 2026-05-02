import 'server-only'

import crypto from 'crypto'

/**
 * Melhor Envio sends a hex-encoded HMAC-SHA256 of the raw request body in the
 * `X-Signature` (or `signature`) header, using the configured secret.
 * Reference: https://docs.melhorenvio.com.br/reference/webhook
 */
export function verifyMelhorEnvioSignature(
  secret: string,
  signature: string | null,
  rawPayload: string,
): boolean {
  if (!secret || !signature) return false

  const provided = signature.trim().replace(/^sha256=/i, '')
  const expected = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex')

  const a = Buffer.from(provided, 'hex')
  const b = Buffer.from(expected, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export type MelhorEnvioFulfillmentTarget =
  | 'in_production'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

/**
 * Maps known Melhor Envio events to our internal fulfillmentStatus.
 * Returns null when the event should not change fulfillment (we still log
 * the webhook for audit, just no state mutation).
 */
export function mapMelhorEnvioEventToFulfillment(
  event: string,
): MelhorEnvioFulfillmentTarget | null {
  const normalized = event.toLowerCase().trim()
  if (normalized.includes('delivered')) return 'delivered'
  if (normalized.includes('posted') || normalized.includes('shipped') || normalized.includes('collected')) {
    return 'shipped'
  }
  if (normalized.includes('generated') || normalized.includes('paid') || normalized.includes('printed')) {
    return 'ready_to_ship'
  }
  if (normalized.includes('canceled') || normalized.includes('cancelled')) return 'cancelled'
  return null
}

export type MelhorEnvioPayloadShape = {
  event?: string
  type?: string
  order?: {
    id?: string
    protocol?: string
    tracking?: string
    tracking_code?: string
    status?: string
  }
  data?: {
    id?: string
    protocol?: string
    tracking?: string
    tracking_code?: string
    status?: string
  }
  protocol?: string
  tracking?: string
}

export function extractTrackingCode(payload: MelhorEnvioPayloadShape): string | null {
  return (
    payload.tracking ||
    payload.protocol ||
    payload.order?.tracking ||
    payload.order?.tracking_code ||
    payload.order?.protocol ||
    payload.data?.tracking ||
    payload.data?.tracking_code ||
    payload.data?.protocol ||
    null
  )
}

export function extractOrderId(payload: MelhorEnvioPayloadShape): string | null {
  return payload.order?.id || payload.data?.id || null
}

export function extractEvent(payload: MelhorEnvioPayloadShape): string {
  return String(payload.event || payload.type || 'unknown')
}
