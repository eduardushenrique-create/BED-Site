import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { addProductFilament } from '@/lib/product-cost'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  let body: { filamentId?: string; variantId?: string | null; grams?: number; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { entry, error } = await addProductFilament({
    productId: id,
    variantId: body.variantId ?? null,
    filamentId: body.filamentId || '',
    grams: Number(body.grams),
    notes: body.notes,
  })

  if (!entry) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'product.filament.upsert',
    targetType: 'ProductFilament',
    targetId: entry.id,
    summary: `Filamento ${entry.filamentName} × ${entry.grams}g vinculado ao produto ${id}`,
    metadata: { productId: id, variantId: entry.variantId, filamentId: entry.filamentId, grams: entry.grams },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json(entry, { status: 201 })
}
