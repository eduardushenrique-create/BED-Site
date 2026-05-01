import crypto from 'crypto'

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!
const MERCADOPAGO_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.mercadopago.com' 
  : 'https://api.mercadopago.com'

export interface PaymentPreference {
  items: Array<{
    id: string
    title: string
    description?: string
    quantity: number
    unit_price: number
    currency_id: string
  }>
  payer: {
    name: string
    email: string
  }
  payment_methods?: {
    excluded_payment_types: Array<{ id: string }>
    installments?: number
  }
  external_reference?: string
  notification_url?: string
}

export interface PaymentResult {
  id: string
  status: string
  status_detail: string
  payment_type: string
  transaction_amount: number
  external_reference: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
    }
  }
  init_point?: string
  sandbox_init_point?: string
}

export async function createPaymentPreference(data: PaymentPreference): Promise<PaymentResult | null> {
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    console.warn('Mercado Pago access token not configured')
    return null
  }

  try {
    const response = await fetch(`${MERCADOPAGO_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: data.items,
        payer: data.payer,
        payment_methods: data.payment_methods || {
          installments: 12,
        },
        external_reference: data.external_reference,
        notification_url: data.notification_url,
        statement_descriptor: 'FORMA3D',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Mercado Pago error:', error)
      return null
    }

    const result = await response.json()
    return result as PaymentResult
  } catch (error) {
    console.error('Error creating payment preference:', error)
    return null
  }
}

export type MercadoPagoPixRequest = {
  amount: number
  description: string
  externalReference: string
  notificationUrl?: string
  payer: {
    email: string
    firstName?: string
    lastName?: string
    cpf?: string
  }
}

export async function createPixPayment(data: MercadoPagoPixRequest) {
  if (!MERCADOPAGO_ACCESS_TOKEN) return null

  const response = await fetch(`${MERCADOPAGO_BASE_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'X-Idempotency-Key': `${data.externalReference}-pix`,
    },
    body: JSON.stringify({
      transaction_amount: data.amount,
      description: data.description,
      payment_method_id: 'pix',
      external_reference: data.externalReference,
      notification_url: data.notificationUrl,
      payer: {
        email: data.payer.email,
        first_name: data.payer.firstName,
        last_name: data.payer.lastName,
        identification: data.payer.cpf
          ? { type: 'CPF', number: data.payer.cpf.replace(/\D/g, '') }
          : undefined,
      },
    }),
  })

  if (!response.ok) {
    console.error('Mercado Pago PIX error:', await response.text())
    return null
  }

  return await response.json()
}

export async function getPaymentDetails(paymentId: string) {
  if (!MERCADOPAGO_ACCESS_TOKEN) return null

  const response = await fetch(`${MERCADOPAGO_BASE_URL}/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
    },
  })

  if (!response.ok) {
    console.error('Mercado Pago payment lookup failed:', await response.text())
    return null
  }

  return await response.json()
}

export async function getPaymentStatus(paymentId: string): Promise<string | null> {
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    return null
  }

  try {
    const response = await fetch(
      `${MERCADOPAGO_BASE_URL}/v1/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.status
  } catch (error) {
    console.error('Error getting payment status:', error)
    return null
  }
}

export function verifyWebhookSignature(
  signature: string | null,
  payload: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return signature === `sha256=${hash}`
}

export function isPaymentApproved(status: string): boolean {
  return ['approved', 'accredited'].includes(status)
}

export function isPaymentPending(status: string): boolean {
  return ['pending', 'in_process'].includes(status)
}

export function isPaymentRejected(status: string): boolean {
  return ['rejected', 'cancelled', 'refunded'].includes(status)
}
