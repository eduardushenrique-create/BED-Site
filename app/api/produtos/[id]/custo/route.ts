import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import {
  getProductCostSettings,
  listProductFilaments,
  updateProductCostSettings,
} from '@/lib/product-cost'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Retorna tudo que a calculadora precisa pra um produto:
 * - filaments (multi-linha vinculado)
 * - settings (printerForCost + printingMinutes + markup + errorRate)
 * - currentPrice do produto (pra cálculo do markup efetivo)
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  const filaments = await listProductFilaments(id)
  const settings = await getProductCostSettings(id)
  let currentPrice: number | null = null
  if (hasDatabase && prisma?.product) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { price: true },
    })
    if (product?.price) currentPrice = Number(product.price.toString())
  }
  return NextResponse.json({ filaments, settings, currentPrice })
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params
  let body: {
    printerForCostId?: string | null
    printingMinutes?: number | null
    markupPercent?: number | null
    errorRatePercent?: number | null
    /** Quando o admin edita o preço final manualmente, o frontend pode mandar
     * isso pra persistir junto. Aceito mas optional. */
    price?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { ok, settings, error } = await updateProductCostSettings(id, body)
  if (!ok) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  // Atualiza o preço do produto se o admin alterou no campo "Preço final"
  if (typeof body.price === 'number' && Number.isFinite(body.price) && body.price >= 0) {
    if (hasDatabase && prisma?.product) {
      try {
        await prisma.product.update({ where: { id }, data: { price: body.price } })
      } catch (err) {
        // Não bloqueia — settings já foram salvas
        console.error('[product-cost] failed to update price:', err)
      }
    }
  }

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'product.cost_settings.update',
    targetType: 'Product',
    targetId: id,
    summary: `Configuração de custo atualizada`,
    metadata: { changes: Object.keys(body) },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ settings })
}
