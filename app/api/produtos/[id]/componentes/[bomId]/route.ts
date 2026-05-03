import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { removeBomEntry, updateBomEntry } from '@/lib/product-bom'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string; bomId: string }>
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id, bomId } = await ctx.params

  let body: { quantityPerUnit?: number; notes?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { ok, error } = await updateBomEntry(bomId, {
    quantityPerUnit: body.quantityPerUnit !== undefined ? Number(body.quantityPerUnit) : undefined,
    notes: body.notes,
  })

  if (!ok) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'product_component.update',
    targetType: 'ProductComponent',
    targetId: bomId,
    summary: `BOM ${bomId} atualizado (produto ${id})`,
    metadata: { changes: Object.keys(body) },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id, bomId } = await ctx.params
  const { ok, error } = await removeBomEntry(bomId)
  if (!ok) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'product_component.delete',
    targetType: 'ProductComponent',
    targetId: bomId,
    summary: `BOM ${bomId} removido (produto ${id})`,
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
