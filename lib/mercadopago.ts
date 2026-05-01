import crypto from 'crypto'
import { captureException, captureMessage } from '@/lib/observability'

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
  backUrls?: {
    success?: string
    pending?: string
    failure?: string
  }
  autoReturn?: 'approved' | 'all'
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
    const hasBackUrls = Boolean(
      data.backUrls && (data.backUrls.success || data.backUrls.pending || data.backUrls.failure)
    )

    const body: Record<string, unknown> = {
      items: data.items,
      payer: data.payer,
      payment_methods: data.payment_methods || {
        installments: 12,
      },
      external_reference: data.external_reference,
      notification_url: data.notification_url,
      statement_descriptor: 'FORMA3D',
    }

    if (hasBackUrls && data.backUrls) {
      body.back_urls = {
        success: data.backUrls.success,
        pending: data.backUrls.pending,
        failure: data.backUrls.failure,
      }
      if (data.autoReturn) {
        body.auto_return = data.autoReturn
      }
    }

    const response = await fetch(`${MERCADOPAGO_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      captureMessage('Mercado Pago preference API returned non-OK', 'error', {
        context: 'mercadopago.createPaymentPreference',
        status: response.status,
        error,
      })
      return null
    }

    const result = await response.json()
    return result as PaymentResult
  } catch (error) {
    captureException(error, { context: 'mercadopago.createPaymentPreference' })
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
    captureMessage('Mercado Pago PIX API returned non-OK', 'error', {
      context: 'mercadopago.createPixPayment',
      status: response.status,
      body: await response.text(),
    })
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
    captureMessage('Mercado Pago payment lookup failed', 'error', {
      context: 'mercadopago.getPaymentDetails',
      paymentId,
      status: response.status,
      body: await response.text(),
    })
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
    captureException(error, { context: 'mercadopago.getPaymentStatus', paymentId })
    return null
  }
}

function parseSignatureParts(signature: string | null) {
  if (!signature) return { ts: null as string | null, v1: null as string | null }

  const parts = signature.split(',')
  let ts: string | null = null
  let v1: string | null = null

  for (const part of parts) {
    const [rawKey, ...rawValue] = part.split('=')
    const key = rawKey?.trim()
    const value = rawValue.join('=').trim()

    if (key === 'ts') ts = value
    if (key === 'v1') v1 = value
  }

  return { ts, v1 }
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function verifyWebhookSignature(
  signature: string | null,
  requestId: string | null,
  dataId: string | null | undefined,
  secret: string,
  maxAgeMs = 5 * 60 * 1000
): boolean {
  if (!signature || !secret || !requestId) {
    return false
  }

  const { ts, v1 } = parseSignatureParts(signature)
  if (!ts || !v1) return false

  const numericTs = Number(ts)
  if (!Number.isFinite(numericTs)) return false

  const normalizedTs = ts.length <= 10 ? numericTs * 1000 : numericTs
  const age = Math.abs(Date.now() - normalizedTs)
  if (age > maxAgeMs) return false

  const manifestParts = []
  if (dataId) manifestParts.push(`id:${String(dataId).toLowerCase()};`)
  manifestParts.push(`request-id:${requestId};`)
  manifestParts.push(`ts:${ts};`)

  const digest = crypto
    .createHmac('sha256', secret)
    .update(manifestParts.join(''))
    .digest('hex')

  return safeCompare(digest, v1)
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
