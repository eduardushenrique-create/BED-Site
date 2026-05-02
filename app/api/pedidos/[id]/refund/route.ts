import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { getOrderByIdOrNumber, updateOrderPaymentByNumber } from '@/lib/database'
import { refundMercadoPagoPayment } from '@/lib/mercadopago'
import { captureException } from '@/lib/observability'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID do pedido é obrigatório.' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const amountInput = body && typeof body.amount === 'number' ? body.amount : undefined
    if (amountInput !== undefined && (!Number.isFinite(amountInput) || amountInput <= 0)) {
      return NextResponse.json({ error: 'Valor de reembolso inválido.' }, { status: 400 })
    }

    const order = await getOrderByIdOrNumber(id)
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (order.paymentStatus === 'refunded') {
      return NextResponse.json(
        { error: 'Pedido já está estornado.' },
        { status: 409 },
      )
    }

    if (order.paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: `Só é possível estornar pedidos pagos. Status atual: ${order.paymentStatus}.` },
        { status: 400 },
      )
    }

    const providerPaymentId = order.paymentDetails?.providerPaymentId
    if (!providerPaymentId) {
      return NextResponse.json(
        { error: 'Pedido sem ID de pagamento no Mercado Pago. Estorno automático indisponível.' },
        { status: 400 },
      )
    }

    if (amountInput !== undefined && amountInput > order.total) {
      return NextResponse.json(
        { error: 'Valor do reembolso não pode exceder o total do pedido.' },
        { status: 400 },
      )
    }

    const result = await refundMercadoPagoPayment(providerPaymentId, amountInput)
    if (!result.ok) {
      if (result.error === 'not_configured') {
        return NextResponse.json(
          { error: 'Mercado Pago não está configurado neste ambiente.' },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { error: `Falha no Mercado Pago: ${result.detail || 'erro desconhecido'}` },
        { status: 502 },
      )
    }

    const isFullRefund =
      amountInput === undefined || Math.abs(result.amount - order.total) < 0.01

    const updated = await updateOrderPaymentByNumber(order.orderNumber, {
      status: isFullRefund ? 'refunded' : order.status,
      paymentStatus: isFullRefund ? 'refunded' : 'paid',
      provider: 'mercadopago',
      method: order.paymentMethod || 'card',
      amount: order.total,
      providerPaymentId,
      pixQrCodeBase64: null,
      pixCopyPaste: null,
      checkoutUrl: order.paymentDetails?.checkoutUrl || null,
      rawPayload: {
        ...((order.paymentDetails as Record<string, unknown>) || {}),
        refunds: [
          ...((Array.isArray((order.paymentDetails as any)?.refunds)
            ? (order.paymentDetails as any).refunds
            : [])),
          {
            refundId: result.refundId,
            amount: result.amount,
            status: result.status,
            createdAt: new Date().toISOString(),
            createdBy: auth.user?.email || null,
            isFullRefund,
          },
        ],
      },
    })

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'order.refund',
      targetType: 'Order',
      targetId: order.id,
      summary: `${isFullRefund ? 'Estorno total' : 'Estorno parcial'} de R$ ${result.amount.toFixed(2)} no pedido ${order.orderNumber}`,
      metadata: {
        refundId: result.refundId,
        amount: result.amount,
        orderNumber: order.orderNumber,
        isFullRefund,
        providerPaymentId,
      },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      refundId: result.refundId,
      amount: result.amount,
      isFullRefund,
      orderNumber: order.orderNumber,
      orderStatus: updated?.status || order.status,
      paymentStatus: updated?.paymentStatus || order.paymentStatus,
    })
  } catch (error) {
    captureException(error, { context: 'api.pedidos.[id].refund', detail: 'POST refund failed' })
    return NextResponse.json({ error: 'Erro ao processar estorno.' }, { status: 500 })
  }
}
