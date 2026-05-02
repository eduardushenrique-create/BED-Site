import { NextRequest, NextResponse } from 'next/server'
import { validateEmail } from '@/lib/validation'
import { findAdminUserByEmail, createPasswordResetToken } from '@/lib/password-reset'
import { sendPasswordResetEmail } from '@/lib/email'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = body?.email
  if (!email || !validateEmail(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const ip = getClientIp(request)

  const captcha = await verifyTurnstileToken(body?.turnstileToken, ip)
  if (!captcha.ok) {
    return NextResponse.json({ error: 'Verificação anti-bot falhou. Recarregue a página e tente novamente.' }, { status: 400 })
  }

  const emailLimit = await consumeRateLimit(
    buildRateLimitKey('request-password-reset:email', normalizedEmail),
    3,
    900,
  )
  if (!emailLimit.ok) {
    const { body, status, headers } = rateLimitResponseBody(emailLimit)
    return NextResponse.json(body, { status, headers })
  }

  const ipLimit = await consumeRateLimit(
    buildRateLimitKey('request-password-reset:ip', ip),
    10,
    900,
  )
  if (!ipLimit.ok) {
    const { body, status, headers } = rateLimitResponseBody(ipLimit)
    return NextResponse.json(body, { status, headers })
  }

  // Always respond 200 to avoid disclosing whether the email maps to an admin.
  try {
    const admin = await findAdminUserByEmail(normalizedEmail)
    if (admin) {
      const token = await createPasswordResetToken(admin.id)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      const resetUrl = `${appUrl.replace(/\/$/, '')}/login/redefinir-senha?token=${encodeURIComponent(token)}`
      await sendPasswordResetEmail(admin.email, admin.name, resetUrl)
    }
  } catch (error) {
    captureException(error, { context: 'api.auth.request-password-reset' })
    // Still return ok to keep the response uniform.
  }

  return NextResponse.json({ ok: true })
}
