import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { removeProductFilament, updateProductFilament } from '@/lib/product-cost'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string; entryId: string }>
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id, entryId } = await ctx.params

  let body: { grams?: number; notes?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { ok, error } = await updateProductFilament(entryId, {
    grams: body.grams !== undefined ? Number(body.grams) : undefined,
    notes: body.notes,
  })
  if (!ok) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'product.filament.update',
    targetType: 'ProductFilament',
    targetId: entryId,
    summary: `Filamento ${entryId} do produto ${id} atualizado`,
    metadata: { changes: Object.keys(body) },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id, entryId } = await ctx.params
  const { ok, error } = await removeProductFilament(entryId)
  if (!ok) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'product.filament.delete',
    targetType: 'ProductFilament',
    targetId: entryId,
    summary: `Filamento ${entryId} removido do produto ${id}`,
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
