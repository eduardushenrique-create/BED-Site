import 'server-only'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

/**
 * Token de descadastro = HMAC(email, secret) base64url.
 *
 * Não usamos JWT/banco de tokens porque (a) é stateless, (b) o link precisa
 * funcionar mesmo se o cliente esperar dias pra clicar, (c) zero dependência
 * em estado adicional. Mesmo modelo do "unsubscribe link" da maioria dos
 * provedores transacionais.
 *
 * Secret cai no AUTH_CODE_PEPPER (mesmo segredo já usado em hashes da auth).
 * Se um dia quisermos pepper separado, basta criar UNSUBSCRIBE_SECRET no env.
 */
function getSecret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.AUTH_CODE_PEPPER ||
    process.env.NEXTAUTH_SECRET ||
    'unsubscribe-fallback-secret'
  )
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function buildUnsubscribeToken(email: string): string {
  const normalized = normalizeEmail(email)
  return crypto
    .createHmac('sha256', getSecret())
    .update(normalized)
    .digest('base64url')
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = buildUnsubscribeToken(email)
  if (token.length !== expected.length) return false
  // timing-safe compare via Buffer
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export function buildUnsubscribeUrl(appUrl: string, email: string): string {
  const token = buildUnsubscribeToken(email)
  const base = appUrl.replace(/\/$/, '')
  const params = new URLSearchParams({ email, token })
  return `${base}/descadastrar?${params.toString()}`
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  if (!hasDatabase || !prisma?.emailUnsubscribe) return false
  const normalized = normalizeEmail(email)
  const row = await prisma.emailUnsubscribe.findUnique({ where: { email: normalized } })
  return Boolean(row)
}

export async function recordUnsubscribe(
  email: string,
  options: { reason?: string; source?: 'link' | 'admin' | 'bounce' } = {},
): Promise<{ ok: boolean }> {
  if (!hasDatabase || !prisma?.emailUnsubscribe) return { ok: false }
  const normalized = normalizeEmail(email)
  await prisma.emailUnsubscribe.upsert({
    where: { email: normalized },
    update: { reason: options.reason || null, source: options.source || 'link' },
    create: { email: normalized, reason: options.reason || null, source: options.source || 'link' },
  })
  return { ok: true }
}

/**
 * Acrescenta um rodapé com link de descadastro ao HTML do e-mail.
 * É OBRIGATÓRIO em qualquer e-mail de campanha (LGPD art. 8 §5 +
 * boas práticas anti-spam). E-mails transacionais (confirmação de
 * pedido, OTP, reset de senha) NÃO usam isso porque são serviço, não
 * marketing.
 */
export function appendUnsubscribeFooter(html: string, appUrl: string, email: string): string {
  const url = buildUnsubscribeUrl(appUrl, email)
  const footer = `
    <hr style="border: none; border-top: 1px solid #E3E9F4; margin: 32px 0 16px;" />
    <p style="font-family: Arial, sans-serif; font-size: 12px; color: #6B7494; text-align: center; line-height: 1.6;">
      Você recebeu este e-mail porque está cadastrado(a) na BED Design.<br />
      Não quer mais receber promoções? <a href="${url}" style="color: #4A7AB5;">Descadastrar</a>.
    </p>
  `
  // Se tem </body>, insere antes; senão, anexa no fim.
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`)
  }
  return `${html}${footer}`
}
