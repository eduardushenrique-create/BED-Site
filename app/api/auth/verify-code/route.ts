import { NextRequest, NextResponse } from 'next/server'
import { consumeAccessCode } from '@/lib/auth-codes'
import { createSession } from '@/lib/auth'
import { findOrCreateSessionUser } from '@/lib/auth-users'
import { validateEmail } from '@/lib/validation'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const { email, code, name } = await request.json()

  if (!email || !validateEmail(email) || !code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'E-mail ou código inválido.' }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const ip = getClientIp(request)

  const emailLimit = await consumeRateLimit(
    buildRateLimitKey('verify-code:email', normalizedEmail),
    5,
    600,
  )
  if (!emailLimit.ok) {
    const { body, status, headers } = rateLimitResponseBody(emailLimit)
    return NextResponse.json(body, { status, headers })
  }

  const ipLimit = await consumeRateLimit(
    buildRateLimitKey('verify-code:ip', ip),
    30,
    600,
  )
  if (!ipLimit.ok) {
    const { body, status, headers } = rateLimitResponseBody(ipLimit)
    return NextResponse.json(body, { status, headers })
  }

  const valid = await consumeAccessCode(normalizedEmail, String(code))
  if (!valid) {
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 })
  }

  const user = await findOrCreateSessionUser(normalizedEmail, name)
  await createSession(user)

  return NextResponse.json({ success: true, user })
}
