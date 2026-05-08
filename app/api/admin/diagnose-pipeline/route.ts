import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de diagnostico do pipeline de pedidos. Util para responder
 * "por que esse pedido virou pronta entrega quando deveria ser sob encomenda?"
 * sem precisar abrir o banco diretamente.
 *
 * Query params:
 *   ?orderNumber=BD-XXXX  — diagnostica o pedido especifico.
 *
 * Retorna:
 *   - schemaCheck: as colunas novas (orderType, deliveryMethod) existem na
 *     tabela Order? Se nao, a migration ainda nao rodou.
 *   - migrationsApplied: lista das migrations efetivamente aplicadas no banco.
 *   - order (se orderNumber): orderType + deliveryMethod CRUS do banco, items
 *     com flags de produto exatamente como o Prisma retorna. Comparar com o
 *     que a UI mostra eh suficiente pra localizar onde a derivacao falhou.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const orderNumber = request.nextUrl.searchParams.get('orderNumber')

  if (!prisma?.order) {
    return NextResponse.json({ error: 'Prisma client indisponivel — sistema rodando em fallback localDb.' }, { status: 503 })
  }

  const result: Record<string, unknown> = {}

  // 1. Schema check: tenta selecionar as colunas novas via raw SQL. Se a
  //    coluna nao existir, o Postgres responde com erro 42703 que vamos
  //    capturar e expor.
  try {
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'Order'
       AND column_name IN ('orderType', 'deliveryMethod', 'productionTimeline', 'currentStageNote')`,
    )
    const found = cols.map(c => c.column_name)
    result.schemaCheck = {
      orderType: found.includes('orderType'),
      deliveryMethod: found.includes('deliveryMethod'),
      productionTimeline: found.includes('productionTimeline'),
      currentStageNote: found.includes('currentStageNote'),
    }
  } catch (err) {
    result.schemaCheck = { error: err instanceof Error ? err.message : String(err) }
  }

  // 2. Migrations aplicadas (segundo a tabela _prisma_migrations).
  try {
    const rows = await prisma.$queryRawUnsafe<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >(
      `SELECT migration_name, finished_at, rolled_back_at
       FROM _prisma_migrations
       ORDER BY started_at DESC
       LIMIT 20`,
    )
    result.migrationsApplied = rows.map(r => ({
      name: r.migration_name,
      finishedAt: r.finished_at?.toISOString() || null,
      rolledBackAt: r.rolled_back_at?.toISOString() || null,
    }))
  } catch (err) {
    result.migrationsApplied = { error: err instanceof Error ? err.message : String(err) }
  }

  // 3. Inspecao de pedido especifico (CRU do banco).
  if (orderNumber) {
    try {
      // Usa raw query para ver EXATAMENTE o que esta no banco, sem passar
      // pelo serializeOrder que pode ter fallbacks.
      const orders = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, "orderNumber", "fulfillmentStatus", "paymentStatus",
                "deliveryMethod", "orderType", "createdAt"
         FROM "Order"
         WHERE "orderNumber" = $1
         LIMIT 1`,
        orderNumber,
      )
      const orderRow = orders[0] || null

      let items: unknown = null
      if (orderRow) {
        items = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT oi.id, oi."productId", oi."productNameSnapshot", oi.quantity,
                  p."underOrder" as "product_underOrder",
                  p."isPersonalizable" as "product_isPersonalizable",
                  p.name as "product_name",
                  p.visibility as "product_visibility"
           FROM "OrderItem" oi
           LEFT JOIN "Product" p ON p.id = oi."productId"
           WHERE oi."orderId" = $1`,
          (orderRow as { id: string }).id,
        )
      }

      result.order = {
        rawFromDb: orderRow,
        items,
        diagnosis: orderRow
          ? {
              orderTypeIsNull: !orderRow.orderType,
              orderTypeValue: orderRow.orderType,
              deliveryMethodValue: orderRow.deliveryMethod,
            }
          : 'pedido nao encontrado no banco — provavelmente foi gravado no fallback localDb',
      }
    } catch (err) {
      result.order = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  return NextResponse.json(result, { status: 200 })
}
