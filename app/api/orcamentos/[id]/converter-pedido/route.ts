import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase, DatabaseUnavailableError } from '@/lib/database'
import { recordAuditEntry } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'
import { getClientIp } from '@/lib/rate-limit'
import {
  createManualOrder,
  ManualOrderValidationError,
  type ManualOrderInput,
} from '@/lib/manual-orders'
import { recalculatePaidAmount } from '@/lib/installments'

export const dynamic = 'force-dynamic'

const VALID_INSTALLMENT_METHODS = new Set([
  'cash',
  'pix_manual',
  'bank_transfer',
  'mercadopago',
  'other',
])

/**
 * SPEC-007 §3.1.2 — POST /api/orcamentos/[id]/converter-pedido
 *
 * Pega um PricingEstimate (status in 'draft'|'sent'|'approved') e cria um
 * pedido manual reusando os snapshots e o nome/customer. Marca o orçamento
 * como 'converted'.
 *
 * Compartilha lib/manual-orders.createManualOrder() com POST /api/admin/orders.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!hasDatabase || !(prisma as any)?.pricingEstimate) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  let body: any = {}
  try {
    const text = await request.text()
    body = text ? JSON.parse(text) : {}
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  try {
    const estimate = await (prisma as any).pricingEstimate.findUnique({
      where: { id },
      include: { product: true },
    })
    if (!estimate) {
      return NextResponse.json({ error: 'Orcamento nao encontrado' }, { status: 404 })
    }
    if (!['draft', 'sent', 'approved'].includes(estimate.status)) {
      return NextResponse.json(
        { error: `Orcamento em status '${estimate.status}' nao pode ser convertido` },
        { status: 409 },
      )
    }

    // Decisao item.itemType: catalog se vinculado a produto, custom caso contrario
    const useFinalPrice =
      estimate.finalPrice != null ? Number(estimate.finalPrice) : Number(estimate.suggestedPrice)

    const item =
      estimate.productId && estimate.product
        ? ({
            itemType: 'catalog' as const,
            productId: estimate.productId,
            quantity: estimate.quantity,
            // Marca priceOverridden via createManualOrder (comparara com product.price)
            unitPriceOverride: useFinalPrice,
            productionNotesItem: estimate.notes ?? null,
            estimateId: estimate.id,
          })
        : ({
            itemType: 'custom' as const,
            productNameSnapshot: estimate.name,
            description: estimate.notes ?? null,
            quantity: estimate.quantity,
            unitPrice: useFinalPrice,
            productionNotesItem: estimate.notes ?? null,
            estimateId: estimate.id,
          })

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

    const manualChannel = body.manualChannel ?? 'outro'
    const input: ManualOrderInput = {
      manualChannel,
      referredBy: body.referredBy ?? null,
      customer: {
        name: estimate.customerName ?? 'Cliente sem nome',
        email: estimate.customerEmail ?? null,
        phone: estimate.customerPhone ?? null,
      },
      items: [item],
      paymentStatus: body.paymentStatus ?? 'pending',
      fulfillmentStatus: body.fulfillmentStatus ?? 'pending',
      productionDeadline: body.productionDeadline ?? null,
      expectedDeliveryAt: body.expectedDeliveryAt ?? null,
      internalNotes: body.internalNotes ?? estimate.notes ?? null,
      createdByEmail: auth.user?.email ?? null,
    }

    const order = await createManualOrder(input)

    // Audit log
    await recordAuditEntry({
      actorEmail: auth.user?.email ?? 'unknown',
      actorRole: auth.user?.role || null,
      action: 'ESTIMATE_CONVERTED',
      targetType: 'PricingEstimate',
      targetId: id,
      summary: `Orcamento "${estimate.name}" convertido em pedido ${order.orderNumber}`,
      metadata: {
        estimateId: id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
      },
      ip: getClientIp(request),
    }).catch(() => {})

    // Pagamento inicial (entrada) opcional
    if (initial && (prisma as any)?.paymentInstallment) {
      try {
        // Transação para installment + recalculo serem atômicos
        // (recalculatePaidAmount exige tx desde refactor de installments).
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
        captureException(err, {
          context: 'api.orcamentos.converter-pedido.initialInstallment',
          orderId: order.id,
        })
      }
    }

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        paymentStatus: order.paymentStatus,
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
    captureException(error, { context: 'api.orcamentos.converter-pedido' })
    return NextResponse.json({ error: 'Erro ao converter orcamento' }, { status: 500 })
  }
}
