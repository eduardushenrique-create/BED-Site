import { NextRequest, NextResponse } from 'next/server'
import { generateAccessCode, storeAccessCode } from '@/lib/auth-codes'
import { sendAccessCodeEmail } from '@/lib/email'
import { validateEmail } from '@/lib/validation'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const ip = getClientIp(request)

    const limit = await consumeRateLimit(
      buildRateLimitKey('request-code', normalizedEmail, ip),
      5,
      900,
    )
    if (!limit.ok) {
      const { body, status, headers } = rateLimitResponseBody(limit)
      return NextResponse.json(body, { status, headers })
    }

    const code = generateAccessCode()
    await storeAccessCode(normalizedEmail, code, ip)
    await sendAccessCodeEmail(normalizedEmail, code)

    return NextResponse.json({
      success: true,
      message: 'Enviamos um código de acesso para o seu e-mail.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar código.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
