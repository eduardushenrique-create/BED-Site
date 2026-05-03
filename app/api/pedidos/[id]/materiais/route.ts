import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface AggregatedRequirement {
  componentId: string
  componentName: string
  componentSku: string | null
  componentUnit: string
  required: number
  inStock: number
  shortage: number
}

/**
 * Agrega o consumo planejado de componentes deste pedido somando o
 * BOM de cada item × quantity. Considera vínculos globais (variantId
 * NULL) + vínculos específicos da variação de cada OrderItem.
 *
 * Resposta:
 *   - requirements: lista por componente com required/inStock/shortage
 *   - hasShortage: boolean — se algum componente está faltando
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.order) {
    return NextResponse.json({ requirements: [], hasShortage: false })
  }

  const { id } = await ctx.params
  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { items: { select: { productId: true, variantId: true, quantity: true } } },
  })
  if (!order) {
    return NextResponse.json({ requirements: [], hasShortage: false })
  }

  // Agrega: componentId -> required total
  const aggregate = new Map<string, AggregatedRequirement>()

  for (const item of order.items) {
    const bom = await prisma.productComponent.findMany({
      where: {
        productId: item.productId,
        OR: [{ variantId: null }, ...(item.variantId ? [{ variantId: item.variantId }] : [])],
      },
      include: { component: true },
    })

    for (const row of bom) {
      const qpu = Number(row.quantityPerUnit.toString())
      if (qpu <= 0) continue
      const required = qpu * item.quantity
      const existing = aggregate.get(row.componentId)
      if (existing) {
        existing.required += required
      } else {
        aggregate.set(row.componentId, {
          componentId: row.componentId,
          componentName: row.component.name,
          componentSku: row.component.sku,
          componentUnit: row.component.unit,
          required,
          inStock: Number(row.component.stock.toString()),
          shortage: 0,
        })
      }
    }
  }

  const requirements = Array.from(aggregate.values()).map(r => ({
    ...r,
    shortage: Math.max(0, r.required - r.inStock),
  }))
  const hasShortage = requirements.some(r => r.shortage > 0)

  return NextResponse.json({ requirements, hasShortage })
}
