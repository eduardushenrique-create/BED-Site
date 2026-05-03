import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { createComponent, listComponents } from '@/lib/components-stock'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  const list = await listComponents({
    search: searchParams.get('search') || undefined,
    onlyLow: searchParams.get('onlyLow') === '1',
    onlyActive: searchParams.get('onlyActive') === '1',
  })
  return NextResponse.json({ components: list })
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { component, error } = await createComponent({
    sku: body.sku as string | null | undefined,
    name: body.name as string,
    description: body.description as string | null | undefined,
    unit: body.unit as string,
    stock: body.stock !== undefined ? Number(body.stock) : 0,
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
  })

  if (!component) {
    return NextResponse.json({ error: error || 'Erro ao criar componente.' }, { status: 400 })
  }

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'component.create',
    targetType: 'Component',
    targetId: component.id,
    summary: `Componente "${component.name}" criado`,
    metadata: { name: component.name, unit: component.unit, sku: component.sku },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json(component, { status: 201 })
}
