import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { getOrderByNumber, updateOrderPaymentByNumber } from '@/lib/database'
import { createPixPayment } from '@/lib/mercadopago'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  try {
    const { orderNumber } = await context.params
    if (!orderNumber) {
      return NextResponse.json({ error: 'Número do pedido é obrigatório.' }, { status: 400 })
    }

    const order = await getOrderByNumber(orderNumber)
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (order.customerEmail.toLowerCase() !== auth.user!.email.toLowerCase()) {
      return NextResponse.json({ error: 'Pedido não pertence ao cliente logado.' }, { status: 403 })
    }

    // SPEC-005 §9.3: pedido criado pelo admin nao tem auto-servico
    // (regenerar PIX, etc). Se cliente tenta, retorna 404.
    if ((order as { createdVia?: string }).createdVia === 'admin') {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (order.paymentStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Só é possível gerar novo Pix para pedidos com pagamento pendente.' },
        { status: 409 },
      )
    }

    if (order.paymentMethod !== 'pix') {
      return NextResponse.json(
        { error: 'Esta opção é apenas para pedidos por Pix.' },
        { status: 400 },
      )
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Mercado Pago não está configurado neste ambiente.' },
        { status: 503 },
      )
    }

    const [firstName, ...rest] = (order.customerName || '').trim().split(/\s+/)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const pix = await createPixPayment(
      {
        amount: order.total,
        description: `Pedido ${order.orderNumber} (renovado)`,
        externalReference: order.orderNumber,
        notificationUrl: appUrl ? `${appUrl}/api/webhooks/mercadopago` : undefined,
        payer: {
          email: order.customerEmail,
          firstName: firstName || order.customerName,
          lastName: rest.join(' ') || undefined,
        },
      },
      { idempotencySuffix: `regen-${Date.now()}` },
    )

    if (!pix) {
      return NextResponse.json(
        { error: 'Não foi possível gerar um novo Pix agora. Tente novamente em instantes.' },
        { status: 502 },
      )
    }

    const newPaymentId = pix.id ? String(pix.id) : null
    const qrBase64 = pix.point_of_interaction?.transaction_data?.qr_code_base64 || null
    const qrCopyPaste = pix.point_of_interaction?.transaction_data?.qr_code || null

    await updateOrderPaymentByNumber(order.orderNumber, {
      status: order.status,
      paymentStatus: 'pending',
      provider: 'mercadopago',
      method: 'pix',
      amount: order.total,
      providerPaymentId: newPaymentId,
      pixQrCodeBase64: qrBase64,
      pixCopyPaste: qrCopyPaste,
      checkoutUrl: null,
      rawPayload: {
        ...((order.paymentDetails as Record<string, unknown>) || {}),
        regeneratedAt: new Date().toISOString(),
        regeneratedBy: auth.user!.email,
        pixQrCodeBase64: qrBase64,
        pixCopyPaste: qrCopyPaste,
      },
    })

    return NextResponse.json({
      ok: true,
      pixQrCodeBase64: qrBase64,
      pixCopyPaste: qrCopyPaste,
    })
  } catch (error) {
    captureException(error, { context: 'api.me.orders.[orderNumber].regenerate-pix' })
    return NextResponse.json({ error: 'Erro ao gerar novo Pix.' }, { status: 500 })
  }
}
