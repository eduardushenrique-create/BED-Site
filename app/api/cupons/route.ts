import { NextRequest, NextResponse } from 'next/server'
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '@/lib/database'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'

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
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'coupon.create',
      targetType: 'Coupon',
      targetId: coupon.id,
      summary: `Cupom ${coupon.code} criado`,
      metadata: { code: coupon.code, type: coupon.type, value: coupon.value },
      ip: getClientIp(request),
    }).catch(() => {})
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
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'coupon.update',
      targetType: 'Coupon',
      targetId: coupon.id,
      summary: `Cupom ${coupon.code} atualizado`,
      metadata: { code: coupon.code, changes: rest },
      ip: getClientIp(request),
    }).catch(() => {})
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
  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'coupon.delete',
    targetType: 'Coupon',
    targetId: id,
    summary: `Cupom ${id} excluído`,
    ip: getClientIp(request),
  }).catch(() => {})
  return NextResponse.json({ success: true })
}
