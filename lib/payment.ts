import 'server-only'

import { createPaymentPreference, createPixPayment } from '@/lib/mercadopago'

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

export async function createPaymentForOrder(input: PaymentCreationInput): Promise<PaymentCreationResult> {
  const provider = process.env.PAYMENT_PROVIDER || 'mercadopago'

  if (provider !== 'mercadopago' || !process.env.MERCADOPAGO_ACCESS_TOKEN) {
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
      return {
        provider: 'mercadopago',
        status: 'pending',
        statusDetail: 'pix_creation_failed',
      }
    }

    return {
      provider: 'mercadopago',
      status: pixPayment.status || 'pending',
      statusDetail: pixPayment.status_detail || undefined,
      providerPaymentId: String(pixPayment.id),
      pixQrCodeBase64: pixPayment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      pixCopyPaste: pixPayment.point_of_interaction?.transaction_data?.qr_code || null,
      rawPayload: {
        ...pixPayment,
        pixQrCodeBase64: pixPayment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        pixCopyPaste: pixPayment.point_of_interaction?.transaction_data?.qr_code || null,
      },
    }
  }

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
  })

  if (!preference) {
    return {
      provider: 'mercadopago',
      status: 'pending',
      statusDetail: 'checkout_creation_failed',
    }
  }

  return {
    provider: 'mercadopago',
    status: preference.status || 'pending',
    statusDetail: preference.status_detail || undefined,
    providerPaymentId: preference.id ? String(preference.id) : undefined,
    checkoutUrl: preference.sandbox_init_point || preference.init_point || undefined,
    rawPayload: {
      ...preference,
      checkoutUrl: preference.sandbox_init_point || preference.init_point || undefined,
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
