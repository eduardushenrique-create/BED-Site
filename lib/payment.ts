import 'server-only'

import { createPaymentPreference, createPixPayment } from '@/lib/mercadopago'
import { captureMessage } from '@/lib/observability'

export type PaymentCreationInput = {
  orderNumber: string
  amount: number
  method: string
  customer: {
    name: string
    email: string
    cpf?: string
  }
  items: Array<{
    id: string
    title: string
    quantity: number
    unitPrice: number
  }>
}

export type PaymentCreationResult = {
  provider: string
  status: string
  statusDetail?: string
  providerPaymentId?: string
  checkoutUrl?: string
  pixQrCodeBase64?: string
  pixCopyPaste?: string
  rawPayload?: Record<string, unknown>
}

function getNotificationUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  return appUrl ? `${appUrl}/api/webhooks/mercadopago` : undefined
}

function getBackUrls(orderNumber: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return undefined

  const encoded = encodeURIComponent(orderNumber)
  return {
    success: `${appUrl}/pedido-confirmado?pedido=${encoded}&status=success`,
    pending: `${appUrl}/pedido-confirmado?pedido=${encoded}&status=pending`,
    failure: `${appUrl}/pedido-confirmado?pedido=${encoded}&status=failure`,
  }
}

export async function createPaymentForOrder(input: PaymentCreationInput): Promise<PaymentCreationResult> {
  const provider = process.env.PAYMENT_PROVIDER || 'mercadopago'

  if (provider !== 'mercadopago' || !process.env.MERCADOPAGO_ACCESS_TOKEN) {
    captureMessage('Payment provider not configured', 'warning', {
      context: 'payment.createPaymentForOrder',
      provider,
      method: input.method,
      orderNumber: input.orderNumber,
      hasAccessToken: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
    })
    return {
      provider: provider || 'manual',
      status: 'pending',
      statusDetail: 'provider_not_configured',
      rawPayload: { fallback: true },
    }
  }

  if (input.method === 'pix') {
    const [firstName, ...rest] = input.customer.name.trim().split(/\s+/)
    const pixPayment = await createPixPayment({
      amount: input.amount,
      description: `Pedido ${input.orderNumber}`,
      externalReference: input.orderNumber,
      notificationUrl: getNotificationUrl(),
      payer: {
        email: input.customer.email,
        firstName,
        lastName: rest.join(' ') || undefined,
        cpf: input.customer.cpf,
      },
    })

    if (!pixPayment) {
      // Sentry breadcrumb pra investigar quando Pix vem null. Não é
      // exception — é fluxo controlado, mas precisa de visibilidade.
      captureMessage('Mercado Pago Pix returned null', 'warning', {
        context: 'payment.createPaymentForOrder',
        orderNumber: input.orderNumber,
        amount: input.amount,
        hasCpf: Boolean(input.customer.cpf),
      })
      return {
        provider: 'mercadopago',
        status: 'pending',
        statusDetail: 'pix_creation_failed',
      }
    }

    const qrBase64 = pixPayment.point_of_interaction?.transaction_data?.qr_code_base64 || null
    const qrCopyPaste = pixPayment.point_of_interaction?.transaction_data?.qr_code || null

    // MP às vezes retorna 200 mas sem qr_code (estado intermediário ou
    // restrição na conta). Loga warning pra investigar — UI mostra
    // botão "Gerar QR Code agora" pra o cliente acionar regenerate-pix.
    if (!qrCopyPaste) {
      captureMessage('Mercado Pago Pix without qr_code', 'warning', {
        context: 'payment.createPaymentForOrder',
        orderNumber: input.orderNumber,
        paymentId: pixPayment.id,
        status: pixPayment.status,
        statusDetail: pixPayment.status_detail,
      })
    }

    return {
      provider: 'mercadopago',
      status: pixPayment.status || 'pending',
      statusDetail: pixPayment.status_detail || undefined,
      providerPaymentId: String(pixPayment.id),
      pixQrCodeBase64: qrBase64,
      pixCopyPaste: qrCopyPaste,
      rawPayload: {
        ...pixPayment,
        pixQrCodeBase64: qrBase64,
        pixCopyPaste: qrCopyPaste,
      },
    }
  }

  const backUrls = getBackUrls(input.orderNumber)

  const preference = await createPaymentPreference({
    items: input.items.map(item => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      currency_id: 'BRL',
    })),
    payer: {
      name: input.customer.name,
      email: input.customer.email,
    },
    payment_methods: {
      excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }],
      installments: 12,
    },
    external_reference: input.orderNumber,
    notification_url: getNotificationUrl(),
    ...(backUrls ? { backUrls, autoReturn: 'approved' as const } : {}),
  })

  if (!preference) {
    captureMessage('Mercado Pago checkout preference creation failed', 'error', {
      context: 'payment.createPaymentForOrder',
      method: input.method,
      orderNumber: input.orderNumber,
      hasBackUrls: Boolean(backUrls),
      hasAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    })
    return {
      provider: 'mercadopago',
      status: 'pending',
      statusDetail: 'checkout_creation_failed',
    }
  }

  const checkoutUrl = preference.sandbox_init_point || preference.init_point || undefined

  if (!checkoutUrl) {
    captureMessage('Mercado Pago preference returned without init_point', 'error', {
      context: 'payment.createPaymentForOrder',
      method: input.method,
      orderNumber: input.orderNumber,
      preferenceId: preference.id,
      preferenceStatus: preference.status,
    })
  }

  return {
    provider: 'mercadopago',
    status: preference.status || 'pending',
    statusDetail: preference.status_detail || undefined,
    providerPaymentId: preference.id ? String(preference.id) : undefined,
    checkoutUrl,
    rawPayload: {
      ...preference,
      checkoutUrl,
    },
  }
}

export function mapMercadoPagoStatus(status: string | null | undefined) {
  switch (status) {
    case 'approved':
    case 'accredited':
      return { orderStatus: 'paid', paymentStatus: 'paid' }
    case 'pending':
    case 'in_process':
    case 'action_required':
      return { orderStatus: 'pending_payment', paymentStatus: 'pending' }
    case 'rejected':
      return { orderStatus: 'pending_payment', paymentStatus: 'rejected' }
    case 'cancelled':
    case 'cancelled_by_user':
    case 'expired':
      return { orderStatus: 'cancelled', paymentStatus: 'cancelled' }
    case 'refunded':
      return { orderStatus: 'refunded', paymentStatus: 'refunded' }
    default:
      return { orderStatus: 'pending_payment', paymentStatus: 'pending' }
  }
}

type MappedPaymentState = ReturnType<typeof mapMercadoPagoStatus>

export function resolvePaymentTransition(
  currentPaymentStatus: string | null | undefined,
  currentOrderStatus: string | null | undefined,
  nextState: MappedPaymentState
) {
  const currentPayment = currentPaymentStatus || 'pending'
  const currentOrder = currentOrderStatus || 'pending_payment'

  if (currentPayment === 'refunded') {
    return {
      orderStatus: currentOrder,
      paymentStatus: currentPayment,
      shouldPersistStatus: false,
    }
  }

  if (currentPayment === 'paid') {
    if (nextState.paymentStatus === 'refunded') {
      return { ...nextState, shouldPersistStatus: true }
    }

    if (nextState.paymentStatus === 'paid') {
      return { ...nextState, shouldPersistStatus: false }
    }

    return {
      orderStatus: currentOrder,
      paymentStatus: currentPayment,
      shouldPersistStatus: false,
    }
  }

  if (currentPayment === 'cancelled') {
    if (nextState.paymentStatus === 'paid') {
      return { ...nextState, shouldPersistStatus: true }
    }

    return {
      orderStatus: currentOrder,
      paymentStatus: currentPayment,
      shouldPersistStatus: false,
    }
  }

  if (currentPayment === 'rejected') {
    if (nextState.paymentStatus === 'paid' || nextState.paymentStatus === 'refunded') {
      return { ...nextState, shouldPersistStatus: true }
    }

    return {
      orderStatus: currentOrder,
      paymentStatus: currentPayment,
      shouldPersistStatus: false,
    }
  }

  return { ...nextState, shouldPersistStatus: true }
}
