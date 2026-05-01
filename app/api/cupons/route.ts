import { NextRequest, NextResponse } from 'next/server'
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '@/lib/database'
import { requireApiAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  return NextResponse.json(await listCoupons())
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  try {
    const body = await request.json()
    const { coupon, error } = await createCoupon(body)
    if (!coupon) {
      return NextResponse.json({ error: error || 'Erro ao criar cupom.' }, { status: 400 })
    }
    return NextResponse.json(coupon, { status: 201 })
  } catch (error) {
    console.error('[api/cupons] POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar cupom.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  try {
    const body = await request.json()
    const { id, ...rest } = body || {}
    if (!id) {
      return NextResponse.json({ error: 'ID do cupom é obrigatório.' }, { status: 400 })
    }
    const { coupon, error } = await updateCoupon(id, rest)
    if (!coupon) {
      return NextResponse.json({ error: error || 'Cupom não encontrado.' }, { status: 404 })
    }
    return NextResponse.json(coupon)
  } catch (error) {
    console.error('[api/cupons] PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar cupom.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID do cupom é obrigatório.' }, { status: 400 })
  }
  const ok = await deleteCoupon(id)
  if (!ok) {
    return NextResponse.json({ error: 'Cupom não encontrado.' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
