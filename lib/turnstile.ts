import 'server-only'

import { captureException } from '@/lib/observability'

/**
 * Cloudflare Turnstile server-side verification.
 *
 * DSN-opcional: sem `TURNSTILE_SECRET_KEY` configurada, todas as chamadas
 * `verifyTurnstileToken` retornam `{ ok: true, skipped: true }` para que o
 * site continue funcionando em dev/local. Em produção, o stakeholder seta as
 * envs e o widget passa a ser obrigatório.
 *
 * Setup:
 *   - NEXT_PUBLIC_TURNSTILE_SITE_KEY  (público, usado no <Turnstile />)
 *   - TURNSTILE_SECRET_KEY            (servidor)
 *
 * Reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

export type TurnstileResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; challengeTs?: string; hostname?: string }
  | { ok: false; reason: 'missing_token' | 'invalid' | 'timeout-or-duplicate' | 'error'; codes?: string[] }

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyTurnstileToken(token: string | null | undefined, ip?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true, skipped: true }
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing_token' }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data) {
      captureException(new Error('Turnstile verify HTTP error'), {
        context: 'turnstile.verify',
        status: response.status,
      })
      return { ok: false, reason: 'error' }
    }

    if (data.success) {
      return { ok: true, skipped: false, challengeTs: data.challenge_ts, hostname: data.hostname }
    }

    const codes: string[] = Array.isArray(data['error-codes']) ? data['error-codes'] : []
    if (codes.includes('timeout-or-duplicate')) {
      return { ok: false, reason: 'timeout-or-duplicate', codes }
    }
    return { ok: false, reason: 'invalid', codes }
  } catch (error) {
    captureException(error, { context: 'turnstile.verify' })
    return { ok: false, reason: 'error' }
  }
}
