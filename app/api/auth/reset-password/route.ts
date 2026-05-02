import { NextRequest, NextResponse } from 'next/server'
import {
  consumePasswordResetTokenAndSetPassword,
  isStrongEnoughPassword,
} from '@/lib/password-reset'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: 'Link inválido. Solicite uma nova redefinição.',
  expired: 'O link expirou. Solicite uma nova redefinição.',
  used: 'Este link já foi usado. Solicite uma nova redefinição.',
  admin_not_found: 'Não foi possível atualizar a senha. Tente novamente.',
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token) {
    return NextResponse.json({ error: 'Token ausente.' }, { status: 400 })
  }
  if (!isStrongEnoughPassword(password)) {
    return NextResponse.json(
      { error: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' },
      { status: 400 },
    )
  }

  const ip = getClientIp(request)
  const ipLimit = await consumeRateLimit(
    buildRateLimitKey('reset-password:ip', ip),
    10,
    900,
  )
  if (!ipLimit.ok) {
    const { body: rlBody, status, headers } = rateLimitResponseBody(ipLimit)
    return NextResponse.json(rlBody, { status, headers })
  }

  try {
    const result = await consumePasswordResetTokenAndSetPassword(token, password)
    if (!result.ok) {
      const message = ERROR_MESSAGES[result.error || 'invalid_token'] || ERROR_MESSAGES.invalid_token
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.auth.reset-password' })
    return NextResponse.json({ error: 'Erro ao redefinir senha.' }, { status: 500 })
  }
}
