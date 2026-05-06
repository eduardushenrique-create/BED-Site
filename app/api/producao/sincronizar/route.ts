import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { syncProductionTasksForPaidOrders } from '@/lib/database'

export const dynamic = 'force-dynamic'

// Backfill manual: cria ProductionTask para pedidos pagos que estão em
// 'pending' ou 'in_production' e ainda não têm tarefa criada. Útil para
// pedidos antigos parados em 'in_production' antes da integração automática
// (lib/order-production-bridge.ts) entrar em operação. Idempotente.

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const input: { orderNumber?: string } = {}

    if (body && typeof body === 'object' && body.orderNumber !== undefined) {
      if (typeof body.orderNumber !== 'string' || !body.orderNumber.trim()) {
        return NextResponse.json(
          { error: 'orderNumber deve ser uma string não vazia.' },
          { status: 400 }
        )
      }
      input.orderNumber = body.orderNumber.trim()
    }

    const result = await syncProductionTasksForPaidOrders(input)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/producao/sincronizar] POST failed:', error)
    return NextResponse.json(
      { error: 'Erro ao sincronizar tarefas de produção.' },
      { status: 500 }
    )
  }
}
