import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { deleteFilament, getFilament, updateFilament } from '@/lib/filaments'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  const filament = await getFilament(id)
  if (!filament) return NextResponse.json({ error: 'Filamento não encontrado.' }, { status: 404 })
  return NextResponse.json(filament)
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { filament, error } = await updateFilament(id, {
    name: body.name as string | undefined,
    brand: body.brand as string | null | undefined,
    type: body.type as string | undefined,
    pricePerKg: body.pricePerKg !== undefined ? Number(body.pricePerKg) : undefined,
    colorHex: body.colorHex as string | null | undefined,
    notes: body.notes as string | null | undefined,
    isActive: body.isActive as boolean | undefined,
  })

  if (!filament) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'filament.update',
    targetType: 'Filament',
    targetId: id,
    summary: `Filamento "${filament.name}" atualizado`,
    metadata: { changes: Object.keys(body) },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json(filament)
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  const before = await getFilament(id)
  const { ok, error } = await deleteFilament(id)
  if (!ok) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'filament.delete',
    targetType: 'Filament',
    targetId: id,
    summary: `Filamento "${before?.name || id}" excluído`,
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
