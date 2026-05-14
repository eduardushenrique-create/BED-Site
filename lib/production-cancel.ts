import 'server-only'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { hasDatabase, DatabaseUnavailableError } from '@/lib/database'
import { recalculatePaidAmount } from '@/lib/installments'

/**
 * SPEC-005 Fase 2b — handlers do DELETE de produção em 3 modos
 * (TASK_ONLY, ITEM_ONLY, ORDER). Cada modo eh uma transacao com
 * lock pessimista no Order, audit gravado pelo caller.
 *
 * R7 do ADR-003 v2: ITEM_ONLY soft-deleta OrderItem (deletedAt) E
 * cancela a ProductionTask correspondente. Recalcula Order.subtotal/total
 * e paidAmount/dueAmount. Se ficou paid > total novo, marca
 * refundStatus='manual_required' (sem chamar API do MP — escopo cortado
 * em ADR-003 v2).
 *
 * R20 do ADR-003 v2: step-up auth (re-password / TOTP) em ORDER fica
 * para PR futuro — UI do PR-8a vai exigir digitar numero do pedido pra
 * habilitar o botao, ja eh uma forma de proteção dupla.
 */

const FAIL_FAST_IN_PRODUCTION =
  process.env.NODE_ENV === 'production' && Boolean(process.env.DATABASE_URL)

const taskClient = (): any => (prisma as any)?.productionTask
const itemClient = (): any => (prisma as any)?.orderItem

export type CancelMode = 'TASK_ONLY' | 'ITEM_ONLY' | 'ORDER'

export type CancelResult = {
  mode: CancelMode
  productionTaskId: string
  orderId: string
  orderNumber: string
  refundDue?: number  // valor que precisa ser estornado manualmente
  itemsCancelled: number
}

function getPrisma(): NonNullable<typeof prisma> {
  if (!hasDatabase || !prisma?.order || !taskClient() || !itemClient()) {
    if (FAIL_FAST_IN_PRODUCTION) {
      throw new DatabaseUnavailableError(
        'Operacao indisponivel no momento. Tente novamente em alguns instantes.',
      )
    }
    throw new DatabaseUnavailableError('DB indisponivel (modo dev/teste sem prisma).')
  }
  return prisma!
}

function toNumber(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0
  if (typeof d === 'number') return d
  return Number(d.toFixed(2))
}

/**
 * Modo TASK_ONLY: apenas cancela a ProductionTask. OrderItem e Order
 * intactos. Uso: tarefa criada por engano, vai ser produzida em outro
 * fluxo, etc.
 */
export async function cancelProductionTaskOnly(
  productionTaskId: string,
): Promise<CancelResult> {
  const db = getPrisma()
  return await db.$transaction(async (tx) => {
    const task = await (tx as any).productionTask.findUnique({
      where: { id: productionTaskId },
      select: {
        id: true,
        orderId: true,
        order: { select: { orderNumber: true } },
      },
    })
    if (!task) throw new Error('Tarefa de producao nao encontrada')

    await (tx as any).productionTask.update({
      where: { id: productionTaskId },
      data: { status: 'cancelled' },
    })

    return {
      mode: 'TASK_ONLY' as const,
      productionTaskId,
      orderId: task.orderId,
      orderNumber: task.order.orderNumber,
      itemsCancelled: 0,
    }
  })
}

/**
 * Modo ITEM_ONLY: cancela a tarefa, soft-deleta o OrderItem
 * correspondente, recalcula Order.subtotal/total. Se Order ja foi pago
 * e novo total < paidAmount, marca refundStatus='manual_required'.
 */
export async function cancelOrderItemViaProduction(
  productionTaskId: string,
): Promise<CancelResult> {
  const db = getPrisma()
  return await db.$transaction(async (tx) => {
    const task = await (tx as any).productionTask.findUnique({
      where: { id: productionTaskId },
      select: {
        id: true,
        orderId: true,
        orderItemId: true,
        order: { select: { orderNumber: true } },
      },
    })
    if (!task) throw new Error('Tarefa de producao nao encontrada')
    if (!task.orderItemId) throw new Error('Tarefa nao tem OrderItem associado')

    // Lock pessimista no Order (R3)
    await tx.$executeRawUnsafe(
      `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
      task.orderId,
    )

    // Soft-delete OrderItem
    const item = await (tx as any).orderItem.update({
      where: { id: task.orderItemId },
      data: { deletedAt: new Date() },
      select: { total: true },
    })

    // Cancela ProductionTask
    await (tx as any).productionTask.update({
      where: { id: productionTaskId },
      data: { status: 'cancelled' },
    })

    // Recalcula Order: subtotal/total a partir dos OrderItems ativos
    const activeItems = await (tx as any).orderItem.findMany({
      where: { orderId: task.orderId, deletedAt: null },
      select: { total: true },
    })
    const newSubtotal = activeItems.reduce(
      (acc: number, i: { total: Prisma.Decimal }) => acc + toNumber(i.total),
      0,
    )

    const order = await tx.order.findUniqueOrThrow({
      where: { id: task.orderId },
      select: {
        orderNumber: true,
        shippingTotal: true,
        discountTotal: true,
        paidAmount: true,
      },
    })
    const shipping = toNumber(order.shippingTotal)
    const discount = toNumber(order.discountTotal)
    const newTotal = Math.max(0, Math.round((newSubtotal + shipping - discount) * 100) / 100)
    const paidNow = toNumber(order.paidAmount)
    const refundDue = paidNow > newTotal ? Math.round((paidNow - newTotal) * 100) / 100 : 0

    await tx.order.update({
      where: { id: task.orderId },
      data: {
        subtotal: newSubtotal,
        total: newTotal,
        ...(refundDue > 0 ? { refundStatus: 'manual_required' } : {}),
      },
    })

    // Recalcula paidAmount/dueAmount (pode mudar dueAmount mesmo sem
    // installment novo, porque total mudou)
    await recalculatePaidAmount(task.orderId, tx)

    return {
      mode: 'ITEM_ONLY' as const,
      productionTaskId,
      orderId: task.orderId,
      orderNumber: order.orderNumber,
      itemsCancelled: 1,
      ...(refundDue > 0 ? { refundDue } : {}),
    }
  })
}

/**
 * Modo ORDER: soft-deleta TODOS os OrderItems, cancela TODAS as
 * ProductionTasks do pedido, marca Order como cancelled. Se pago > 0,
 * refundStatus='manual_required'.
 */
export async function cancelEntireOrderViaProduction(
  productionTaskId: string,
): Promise<CancelResult> {
  const db = getPrisma()
  return await db.$transaction(async (tx) => {
    const task = await (tx as any).productionTask.findUnique({
      where: { id: productionTaskId },
      select: {
        id: true,
        orderId: true,
        order: { select: { orderNumber: true } },
      },
    })
    if (!task) throw new Error('Tarefa de producao nao encontrada')

    await tx.$executeRawUnsafe(
      `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
      task.orderId,
    )

    // Soft-delete todos os OrderItems ativos
    const itemsResult = await (tx as any).orderItem.updateMany({
      where: { orderId: task.orderId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    // Cancela todas as ProductionTasks do pedido (inclusive a que iniciou
    // esta operacao)
    await (tx as any).productionTask.updateMany({
      where: { orderId: task.orderId, status: { not: 'cancelled' } },
      data: { status: 'cancelled' },
    })

    // Marca Order como cancelado
    const order = await tx.order.findUniqueOrThrow({
      where: { id: task.orderId },
      select: { orderNumber: true, paidAmount: true },
    })
    const paidNow = toNumber(order.paidAmount)
    const refundDue = paidNow > 0 ? paidNow : 0

    await tx.order.update({
      where: { id: task.orderId },
      data: {
        status: 'cancelled',
        fulfillmentStatus: 'cancelled',
        ...(refundDue > 0 ? { refundStatus: 'manual_required' } : {}),
      },
    })

    return {
      mode: 'ORDER' as const,
      productionTaskId,
      orderId: task.orderId,
      orderNumber: order.orderNumber,
      itemsCancelled: itemsResult.count,
      ...(refundDue > 0 ? { refundDue } : {}),
    }
  })
}
