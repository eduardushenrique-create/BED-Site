import { NextRequest, NextResponse } from 'next/server'
import { validateAndCalculateCoupon } from '@/lib/database'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'

const log = createLogger({ component: 'api/coupons/validate' })

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // A3 — enumeração de cupons: a resposta diferencia claramente cupom
    // válido/inválido, então sem throttle vira oráculo de brute-force.
    // 20 req / 10 min por IP é folgado pro uso legítimo (1 validação por checkout).
    const rl = await consumeRateLimit(buildRateLimitKey('coupons-validate', getClientIp(request)), 20, 600)
    if (!rl.ok) {
      const { status, headers } = rateLimitResponseBody(rl)
      return NextResponse.json(
        { valid: false, error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
        { status, headers },
      )
    }

    const body = await request.json().catch(() => ({}))
    const code = typeof body?.code === 'string' ? body.code : ''
    const subtotal = Number(body?.subtotal)

    if (!code.trim()) {
      return NextResponse.json({ valid: false, error: 'Informe um código de cupom.' })
    }
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ valid: false, error: 'Subtotal inválido.' })
    }

    const result = await validateAndCalculateCoupon(code, subtotal)
    if (!result.ok) {
      return NextResponse.json({ valid: false, error: result.error })
    }

    const { coupon, discount } = result
    const message =
      coupon.type === 'percentage'
        ? `Cupom aplicado: ${coupon.value}% de desconto.`
        : `Cupom aplicado: R$ ${coupon.value.toFixed(2).replace('.', ',')} de desconto.`

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
      message,
    })
  } catch (error) {
    captureException(error, { context: 'api/coupons/validate', detail: 'POST failed' })
    log.error({ err: error }, 'POST /api/coupons/validate failed')
    return NextResponse.json({ valid: false, error: 'Erro ao validar cupom.' }, { status: 500 })
  }
}
