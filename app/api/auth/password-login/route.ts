import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { authenticateAdminWithPassword } from '@/lib/auth-password'
import { validateEmail } from '@/lib/validation'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !validateEmail(email) || !password) {
    return NextResponse.json({ error: 'Informe e-mail e senha válidos.' }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const ip = getClientIp(request)

  const emailLimit = await consumeRateLimit(
    buildRateLimitKey('password-login:email', normalizedEmail),
    5,
    600,
  )
  if (!emailLimit.ok) {
    const { body, status, headers } = rateLimitResponseBody(emailLimit)
    return NextResponse.json(body, { status, headers })
  }

  const ipLimit = await consumeRateLimit(
    buildRateLimitKey('password-login:ip', ip),
    20,
    600,
  )
  if (!ipLimit.ok) {
    const { body, status, headers } = rateLimitResponseBody(ipLimit)
    return NextResponse.json(body, { status, headers })
  }

  const user = await authenticateAdminWithPassword(normalizedEmail, password)
  if (!user) {
    return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
  }

  await createSession(user)
  return NextResponse.json({ success: true, user })
}
