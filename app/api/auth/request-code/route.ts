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
import { verifyTurnstileToken } from '@/lib/turnstile'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, turnstileToken } = body || {}
    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const ip = getClientIp(request)

    const captcha = await verifyTurnstileToken(turnstileToken, ip)
    if (!captcha.ok) {
      return NextResponse.json({ error: 'Verificação anti-bot falhou. Recarregue a página e tente novamente.' }, { status: 400 })
    }

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
    const sent = await sendAccessCodeEmail(normalizedEmail, code)

    // Antes retornava 200 mesmo se o Resend falhou — usuário via
    // "código enviado" e nunca recebia nada. Agora propagamos o erro.
    // `sent` retorna true em dev sem RESEND_API_KEY (loga no console).
    if (!sent) {
      return NextResponse.json(
        { error: 'Não foi possível enviar o código no momento. Tente novamente em alguns instantes.' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Enviamos um código de acesso para o seu e-mail.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar código.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
