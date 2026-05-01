import { NextRequest, NextResponse } from 'next/server'
import { validateAndCalculateCoupon } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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
    console.error('[api/coupons/validate] error:', error)
    return NextResponse.json({ valid: false, error: 'Erro ao validar cupom.' }, { status: 500 })
  }
}
