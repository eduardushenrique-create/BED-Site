import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { addBomEntry, getProductCoverage, listProductBom } from '@/lib/product-bom'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  const { searchParams } = new URL(request.url)
  const variantId = searchParams.get('variantId')
  const entries = await listProductBom(id)
  const coverage = await getProductCoverage(id, variantId)
  return NextResponse.json({ entries, coverage })
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params

  let body: { componentId?: string; variantId?: string | null; quantityPerUnit?: number; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.componentId) {
    return NextResponse.json({ error: 'componentId obrigatório.' }, { status: 400 })
  }
  const qpu = Number(body.quantityPerUnit)
  if (!Number.isFinite(qpu) || qpu <= 0) {
    return NextResponse.json({ error: 'quantityPerUnit deve ser maior que zero.' }, { status: 400 })
  }

  const { entry, error } = await addBomEntry({
    productId: id,
    componentId: body.componentId,
    variantId: body.variantId ?? null,
    quantityPerUnit: qpu,
    notes: body.notes,
  })

  if (!entry) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'product_component.upsert',
    targetType: 'ProductComponent',
    targetId: entry.id,
    summary: `BOM: ${entry.componentName} × ${entry.quantityPerUnit} ${entry.componentUnit}/un (produto ${id}${entry.variantId ? `, variação ${entry.variantId}` : ''})`,
    metadata: {
      productId: id,
      variantId: entry.variantId,
      componentId: entry.componentId,
      quantityPerUnit: entry.quantityPerUnit,
    },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json(entry, { status: 201 })
}
