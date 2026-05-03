import 'server-only'

import crypto from 'crypto'

/**
 * Resend entrega webhooks via Svix. A assinatura usa HMAC-SHA256 sobre
 * a string "<svix-id>.<svix-timestamp>.<rawBody>" com o whsec do dashboard
 * (formato `whsec_<base64>`). Pode haver MÚLTIPLAS assinaturas válidas no
 * header (chave em rotação), separadas por espaço — basta uma bater.
 *
 * Implementamos manualmente em vez de usar a lib `svix` pra (a) evitar nova
 * dep, (b) manter o handler self-contained mesmo se Resend trocar de
 * provider de webhook futuramente.
 */
export function verifyResendSignature(
  headers: { svixId: string | null; svixTimestamp: string | null; svixSignature: string | null },
  rawBody: string,
  secret: string,
): boolean {
  const { svixId, svixTimestamp, svixSignature } = headers
  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false

  // Replay window — 5 min é o default da Svix.
  const tsSec = Number(svixTimestamp)
  if (!Number.isFinite(tsSec)) return false
  const ageSec = Math.abs(Date.now() / 1000 - tsSec)
  if (ageSec > 300) return false

  const decodedSecret = decodeWhsec(secret)
  if (!decodedSecret) return false

  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', decodedSecret).update(signedPayload).digest('base64')

  // Header pode ter múltiplas assinaturas: "v1,base64sig v1,base64sig2"
  const candidates = svixSignature.split(' ')
  for (const candidate of candidates) {
    const [version, sig] = candidate.split(',')
    if (version !== 'v1' || !sig) continue
    if (constantTimeEqual(sig, expected)) return true
  }
  return false
}

function decodeWhsec(secret: string): Buffer | null {
  // Formato esperado: whsec_<base64>. Aceita também sem prefixo (defensivo).
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  try {
    return Buffer.from(raw, 'base64')
  } catch {
    return null
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

// ---------------------------------------------------------------------------
// Tipos do payload — versão atual (2026-05). Resend documenta como estável.
// ---------------------------------------------------------------------------

export type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'

export interface ResendEvent {
  type: ResendEventType
  created_at?: string
  data?: {
    email_id?: string
    from?: string
    to?: string[]
    subject?: string
    bounce?: { type?: 'hard' | 'soft' | string; subType?: string; message?: string }
  }
}

export function extractRecipients(event: ResendEvent): string[] {
  const list = event.data?.to
  if (!Array.isArray(list)) return []
  return list
    .map(addr => (typeof addr === 'string' ? addr.trim().toLowerCase() : ''))
    .filter(Boolean)
}

/**
 * Decide se um evento DEVE virar opt-out automático.
 * - complained: SEMPRE — usuário marcou como spam, parar imediatamente
 * - bounced HARD: SEMPRE — endereço inválido, continuar enviando degrada reputação
 * - bounced SOFT: NÃO — caixa cheia / temporário, vale tentar de novo
 * - resto: ignorado
 */
export function shouldOptOut(event: ResendEvent): boolean {
  if (event.type === 'email.complained') return true
  if (event.type === 'email.bounced') {
    const bounceType = event.data?.bounce?.type?.toLowerCase()
    return bounceType === 'hard'
  }
  return false
}
