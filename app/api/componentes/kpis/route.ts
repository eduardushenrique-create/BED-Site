import { NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { listComponents } from '@/lib/components-stock'

export const dynamic = 'force-dynamic'

/**
 * KPIs agregados pra dashboard do /admin/componentes:
 *   - total: quantos componentes ativos
 *   - inLow: quantos estão em baixa (stock <= threshold)
 *   - zeroed: quantos estão zerados (stock === 0)
 *   - estimatedValue: soma de stock × costPerUnit dos que têm
 *     costPerUnit cadastrado. Se nenhum tem, retorna null pra UI esconder.
 *
 * Cálculo é em memória — listComponents já traz tudo. Para dezenas de
 * milhares, mover pra agregação SQL.
 */
export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const list = await listComponents({ onlyActive: true })

  let total = 0
  let inLow = 0
  let zeroed = 0
  let valueSum = 0
  let countedForValue = 0

  for (const c of list) {
    total += 1
    if (c.stock === 0) zeroed += 1
    else if (c.isLow) inLow += 1
    if (c.costPerUnit !== null) {
      valueSum += c.stock * c.costPerUnit
      countedForValue += 1
    }
  }

  return NextResponse.json({
    total,
    inLow,
    zeroed,
    estimatedValue: countedForValue > 0 ? Math.round(valueSum * 100) / 100 : null,
    componentsWithCost: countedForValue,
  })
}
