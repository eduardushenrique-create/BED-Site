import { NextRequest, NextResponse } from 'next/server'
import { subscribeToRestock } from '@/lib/database'
import { validateEmail } from '@/lib/validation'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
  const variantId = typeof body?.variantId === 'string' ? body.variantId.trim() : null

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }
  if (!productId) {
    return NextResponse.json({ error: 'Produto é obrigatório.' }, { status: 400 })
  }

  const ip = getClientIp(request)
  const ipLimit = await consumeRateLimit(buildRateLimitKey('restock-alert:ip', ip), 10, 600)
  if (!ipLimit.ok) {
    const { body: rlBody, status, headers } = rateLimitResponseBody(ipLimit)
    return NextResponse.json(rlBody, { status, headers })
  }
  const emailLimit = await consumeRateLimit(buildRateLimitKey('restock-alert:email', email.toLowerCase()), 5, 600)
  if (!emailLimit.ok) {
    const { body: rlBody, status, headers } = rateLimitResponseBody(emailLimit)
    return NextResponse.json(rlBody, { status, headers })
  }

  try {
    const result = await subscribeToRestock({ email, productId, variantId })
    if (!result.ok) {
      return NextResponse.json({ error: 'Não foi possível registrar.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.products.restock-alerts' })
    return NextResponse.json({ error: 'Erro ao registrar.' }, { status: 500 })
  }
}
