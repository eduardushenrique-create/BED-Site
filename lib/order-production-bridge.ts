import 'server-only'

import { ensureProductionTasksForOrder, type EnsureProductionResult } from '@/lib/database'
import { createLogger } from '@/lib/logger'
import { captureException } from '@/lib/observability'

const log = createLogger({ component: 'order-production-bridge' })

/**
 * Resultado de `triggerProductionTasksOnStatusChange`.
 *
 * - `triggered=false`: nada foi feito (status não mudou para `in_production`,
 *   ou já estava em `in_production`). Resposta inerte por design.
 * - `triggered=true`: tentamos criar tasks. `created` indica quantas foram
 *   efetivamente criadas (0 também é válido — pode ter sido idempotente). Se
 *   houver `skipped`, traz o motivo (ex: `order_not_paid`, `order_not_found`).
 *   `error=true` indica falha inesperada (já reportada ao Sentry); o caller
 *   deve seguir com a transição normalmente.
 */
export type TriggerProductionResult =
  | { triggered: false }
  | {
      triggered: true
      created: number
      skipped?: string
      error?: boolean
    }

export interface OrderForBridge {
  id: string
  fulfillmentStatus: string
  status?: string | null
  orderNumber?: string | null
}

/**
 * Quando um pedido entra em `in_production` (e ainda não estava), garante que
 * existam tarefas de produção (`ProductionTask`) para os itens elegíveis.
 *
 * Idempotente: se o pedido já estava em `in_production`, retorna inerte.
 * Não destrutivo: nunca lança — falhas internas viram `error: true` no
 * resultado, para o caller decidir se quer expor warning ao admin.
 *
 * Casos de borda:
 * - `previousStatus === order.fulfillmentStatus`: nada a fazer.
 * - `order.fulfillmentStatus !== 'in_production'`: nada a fazer.
 * - Pedido sem `status='paid'`: a função `ensureProductionTasksForOrder` vai
 *   retornar `skipped: 'order_not_paid'`. Propagamos esse motivo no resultado
 *   para que o caller exiba um warning. NÃO bloqueamos a transição.
 */
export async function triggerProductionTasksOnStatusChange(
  order: OrderForBridge,
  previousStatus: string | null | undefined,
): Promise<TriggerProductionResult> {
  if (!order || !order.id) return { triggered: false }
  if (order.fulfillmentStatus !== 'in_production') return { triggered: false }
  if (previousStatus === 'in_production') return { triggered: false }

  try {
    const result: EnsureProductionResult = await ensureProductionTasksForOrder(order.id)
    log.info(
      {
        orderId: order.id,
        orderNumber: order.orderNumber || null,
        from: previousStatus || null,
        created: result.created,
        skipped: result.skipped || null,
      },
      'production tasks ensured on fulfillmentStatus change',
    )
    return {
      triggered: true,
      created: result.created,
      skipped: result.skipped,
    }
  } catch (err) {
    captureException(err, {
      context: 'order-production-bridge',
      detail: 'triggerProductionTasksOnStatusChange failed',
      orderId: order.id,
      orderNumber: order.orderNumber || null,
    })
    log.error(
      { err, orderId: order.id, orderNumber: order.orderNumber || null },
      'failed to ensure production tasks on status change',
    )
    return { triggered: true, created: 0, error: true }
  }
}
