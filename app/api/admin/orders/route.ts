import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'
import { getClientIp } from '@/lib/rate-limit'
import {
  createManualOrder,
  ManualOrderValidationError,
  type ManualOrderInput,
} from '@/lib/manual-orders'
import { recalculatePaidAmount } from '@/lib/installments'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { hasDatabase, DatabaseUnavailableError } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * SPEC-007 §3.3.2 — POST /api/admin/orders
 *
 * Cria pedido manual (createdVia='admin') com items 'catalog' E/OU 'custom'.
 * Distinta de POST /api/pedidos (que tambem cria manual, mas pre-SPEC-007 e
 * sem itens custom).
 *
 * Body: ManualOrderInput (lib/manual-orders.ts) + initialInstallment opcional.
 * Resposta: { id, orderNumber, total, paymentStatus, fulfillmentStatus }
 */

const VALID_INSTALLMENT_METHODS = new Set([
  'cash',
  'pix_manual',
  'bank_transfer',
  'mercadopago',
  'other',
])

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const input: ManualOrderInput = {
    manualChannel: body.manualChannel,
    referredBy: body.referredBy ?? null,
    customer: body.customer ?? { name: '' },
    items: Array.isArray(body.items) ? body.items : [],
    discountTotal: body.discountTotal,
    discountReason: body.discountReason ?? null,
    shippingTotal: body.shippingTotal,
    shippingMethod: body.shippingMethod ?? null,
    deliveryMethod: body.deliveryMethod ?? 'shipping',
    orderType: body.orderType,
    paymentStatus: body.paymentStatus ?? 'pending',
    fulfillmentStatus: body.fulfillmentStatus ?? 'pending',
    productionDeadline: body.productionDeadline ?? null,
    expectedDeliveryAt: body.expectedDeliveryAt ?? null,
    internalNotes: body.internalNotes ?? null,
    notes: body.notes ?? null,
    createdByEmail: auth.user?.email ?? null,
  }

  // Validacao do initialInstallment (se vier)
  const initial = body.initialInstallment
  if (initial) {
    if (!Number.isFinite(Number(initial.amount)) || Number(initial.amount) <= 0) {
      return NextResponse.json(
        { error: 'initialInstallment.amount deve ser > 0' },
        { status: 400 },
      )
    }
    if (!initial.method || !VALID_INSTALLMENT_METHODS.has(initial.method)) {
      return NextResponse.json(
        {
          error: `initialInstallment.method invalido. Use um de: ${Array.from(VALID_INSTALLMENT_METHODS).join(', ')}`,
        },
        { status: 400 },
      )
    }
  }

  try {
    const order = await createManualOrder(input)

    // Audit log inicial (criacao). Se houver installment, audit dela vem do
    // proprio lib/installments via recalculatePaidAmount.
    await recordAuditEntry({
      actorEmail: auth.user?.email ?? 'unknown',
      actorRole: auth.user?.role || null,
      action: 'ORDER_CREATED_MANUALLY',
      targetType: 'Order',
      targetId: order.id,
      summary: `Pedido manual ${order.orderNumber} criado via ${input.manualChannel} (R$ ${order.total.toFixed(2)}, ${order.itemCount} item${order.itemCount === 1 ? '' : 's'})`,
      metadata: {
        orderNumber: order.orderNumber,
        manualChannel: input.manualChannel,
        referredBy: input.referredBy,
        customer: input.customer.name,
        total: order.total,
        itemCount: order.itemCount,
      },
      ip: getClientIp(request),
    }).catch(() => {})

    // Pagamento inicial opcional (entrada). Cria PaymentInstallment + recalcula
    // paidAmount/dueAmount/paymentStatus (lib/installments.ts).
    if (initial && hasDatabase && (prisma as any)?.paymentInstallment) {
      try {
        // Transação garante atomicidade: installment criado e totals
        // recalculados juntos (recalculatePaidAmount exige tx desde refactor
        // de installments). Falha em qualquer um aborta o pagamento inicial
        // sem desfazer o pedido (catch externo só audita).
        await prisma.$transaction(async (tx: any) => {
          await tx.paymentInstallment.create({
            data: {
              orderId: order.id,
              sequence: 1,
              amount: new Prisma.Decimal(Number(initial.amount)),
              method: initial.method,
              description: initial.description ?? 'Entrada',
              receivedAt: initial.receivedAt ? new Date(initial.receivedAt) : new Date(),
              receivedByEmail: auth.user?.email ?? 'unknown',
              notes: initial.notes ?? null,
              isRefund: false,
            },
          })
          await recalculatePaidAmount(order.id, tx)
        })
      } catch (err) {
        // Audit a falha do installment mas nao desfaz o pedido — admin pode
        // registrar a entrada manualmente em /admin/pedidos/[id] depois.
        captureException(err, {
          context: 'api.admin.orders.initialInstallment',
          orderId: order.id,
        })
      }
    }

    return NextResponse.json(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        subtotal: order.subtotal,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        itemCount: order.itemCount,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof ManualOrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    captureException(error, { context: 'api.admin.orders.POST' })
    return NextResponse.json({ error: 'Erro ao criar pedido manual' }, { status: 500 })
  }
}
