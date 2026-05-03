import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import {
  deleteComponent,
  getComponent,
  listMovements,
  updateComponent,
} from '@/lib/components-stock'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  const component = await getComponent(id)
  if (!component) return NextResponse.json({ error: 'Componente não encontrado.' }, { status: 404 })
  const movements = await listMovements(id, { take: 50 })
  return NextResponse.json({ component, movements })
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

  const update = {
    sku: body.sku as string | null | undefined,
    name: body.name as string | undefined,
    description: body.description as string | null | undefined,
    unit: body.unit as string | undefined,
    lowStockThreshold:
      body.lowStockThreshold === null
        ? null
        : body.lowStockThreshold !== undefined
          ? Number(body.lowStockThreshold)
          : undefined,
    supplier: body.supplier as string | null | undefined,
    supplierUrl: body.supplierUrl as string | null | undefined,
    costPerUnit:
      body.costPerUnit === null
        ? null
        : body.costPerUnit !== undefined
          ? Number(body.costPerUnit)
          : undefined,
    notes: body.notes as string | null | undefined,
    isActive: body.isActive as boolean | undefined,
  }

  const { component, error } = await updateComponent(id, update)
  if (!component) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'component.update',
    targetType: 'Component',
    targetId: id,
    summary: `Componente "${component.name}" atualizado`,
    metadata: { changes: Object.keys(body) },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json(component)
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  const before = await getComponent(id)
  const { ok, error } = await deleteComponent(id)
  if (!ok) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'component.delete',
    targetType: 'Component',
    targetId: id,
    summary: `Componente "${before?.name || id}" excluído`,
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
