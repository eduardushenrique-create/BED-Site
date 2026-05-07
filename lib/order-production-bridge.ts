import 'server-only'

import { ensureProductionTasksForOrder, type EnsureProductionResult } from '@/lib/database'
import { createLogger } from '@/lib/logger'
import { captureException } from '@/lib/observability'

const log = createLogger({ component: 'order-production-bridge' })

/**
 * Resultado de `triggerProductionTasksOnStatusChange`.
 *
 * - `triggered=false`: nada foi feito (fulfillmentStatus não entrou em uma
 *   fase de produção, ou já estava em uma). Resposta inerte por design.
 * - `triggered=true`: tentamos criar tasks. `created` indica quantas foram
 *   efetivamente criadas (0 também é válido — pode ter sido idempotente). Se
 *   houver `skipped`, traz o motivo (`already_exists`, `no_eligible_items`,
 *   `not_in_production_phase`, `order_not_found`). `unpaid=true` sinaliza
 *   que tasks foram criadas mesmo com pagamento pendente — caller deve
 *   avisar (mas não bloquear). `error=true` indica falha inesperada (já
 *   reportada ao Sentry); o caller deve seguir com a transição normalmente.
 */
export type TriggerProductionResult =
  | { triggered: false }
  | {
      triggered: true
      created: number
      skipped?: string
      unpaid?: boolean
      error?: boolean
    }

export interface OrderForBridge {
  id: string
  fulfillmentStatus: string
  status?: string | null
  orderNumber?: string | null
}

// Estágios em que a fila de impressão precisa estar carregada. `liberado_producao`
// é o "disponível para produção" do stakeholder: a partir daí o operador
// consulta a tabela /admin/producao para saber o que falta imprimir.
// `in_production` mantido para o caso de admin pular fases via edição manual.
const PRODUCTION_TRIGGER_STATUSES = new Set<string>([
  'liberado_producao',
  'in_production',
])

/**
 * Quando um pedido entra numa fase de produção (`liberado_producao` ou
 * `in_production`) e ainda não estava em uma delas, garante que existam
 * tarefas (`ProductionTask`) para os itens elegíveis.
 *
 * Idempotente: re-entradas (mesma fase ou outra fase de produção) retornam
 * inerte. `ensureProductionTasksForOrder` por si só já é idempotente por
 * `orderItemId` único, então é seguro reentrar.
 *
 * Não destrutivo: nunca lança — falhas internas viram `error: true` no
 * resultado, para o caller decidir se quer expor warning ao admin.
 *
 * Casos de borda:
 * - `previousStatus` já era uma fase de produção: nada a fazer.
 * - `order.fulfillmentStatus` não é fase de produção: nada a fazer.
 * - Pedido sem `paymentStatus='paid'`: NÃO bloqueia. Tasks são criadas e o
 *   resultado vem com `unpaid: true` para o caller avisar o admin
 *   (pagamento na entrega/retirada eh fluxo legitimo).
 */
export async function triggerProductionTasksOnStatusChange(
  order: OrderForBridge,
  previousStatus: string | null | undefined,
): Promise<TriggerProductionResult> {
  if (!order || !order.id) return { triggered: false }
  if (!PRODUCTION_TRIGGER_STATUSES.has(order.fulfillmentStatus)) {
    return { triggered: false }
  }
  if (previousStatus && PRODUCTION_TRIGGER_STATUSES.has(previousStatus)) {
    return { triggered: false }
  }

  try {
    const result: EnsureProductionResult = await ensureProductionTasksForOrder(order.id)
    log.info(
      {
        orderId: order.id,
        orderNumber: order.orderNumber || null,
        from: previousStatus || null,
        created: result.created,
        skipped: result.skipped || null,
        unpaid: result.unpaid || false,
      },
      'production tasks ensured on fulfillmentStatus change (liberado_producao | in_production)',
    )
    return {
      triggered: true,
      created: result.created,
      skipped: result.skipped,
      unpaid: result.unpaid,
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
