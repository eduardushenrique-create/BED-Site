import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPaymentDetails, verifyWebhookSignature } from '@/lib/mercadopago'
import { ensureProductionTasksForOrder, getOrderByNumber, registerWebhookEvent, updateOrderPaymentByNumber, updateWebhookEvent } from '@/lib/database'
import { mapMercadoPagoStatus, resolvePaymentTransition } from '@/lib/payment'
import { captureException } from '@/lib/observability'

type MercadoPagoWebhookPayment = {
  payment_method_id?: string
  transaction_amount?: number
  date_approved?: string | null
  transaction_details?: {
    external_resource_url?: string | null
  }
  point_of_interaction?: {
    transaction_data?: {
      qr_code_base64?: string | null
      qr_code?: string | null
    }
  }
  [key: string]: unknown
}

function buildPayloadHash(payload: string) {
  return crypto.createHash('sha256').update(payload).digest('hex')
}

function buildDeliveryKey(topic: string, notificationId: string | null, resourceId: string | null, action: string | null, payloadHash: string) {
  if (notificationId) {
    return `mercadopago:${topic}:${notificationId}`
  }

  const resourcePart = resourceId || 'no-resource'
  const actionPart = action || 'no-action'
  return `mercadopago:${topic}:${resourcePart}:${actionPart}:${payloadHash}`
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
    if (!webhookSecret || !webhookSecret.trim()) {
      console.error('[webhook] MERCADOPAGO_WEBHOOK_SECRET not configured — rejecting')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 }
      )
    }

    const signature = request.headers.get('x-signature')
    const requestId = request.headers.get('x-request-id')
    const payload = await request.text()
    const payloadHash = buildPayloadHash(payload)

    const raw = JSON.parse(payload)
    const topic = raw.type || raw.topic || 'unknown'
    const notificationId = raw.id ? String(raw.id) : null
    const resourceId = raw.data?.id ? String(raw.data.id) : notificationId
    const action = raw.action ? String(raw.action) : null
    const dataId = request.nextUrl.searchParams.get('data.id') || resourceId
    const deliveryKey = buildDeliveryKey(topic, notificationId, resourceId, action, payloadHash)

    if (!verifyWebhookSignature(signature, requestId, dataId, webhookSecret)) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const receipt = await registerWebhookEvent({
      provider: 'mercadopago',
      deliveryKey,
      topic,
      resourceId: resourceId || undefined,
      eventId: notificationId || undefined,
      action: action || undefined,
      paymentId: topic === 'payment' ? (resourceId || undefined) : undefined,
      payloadHash,
      signature,
    })

    if (!receipt.created && receipt.event?.status === 'processed') {
      return NextResponse.json({ received: true, duplicate: true })
    }

    const paymentId = topic === 'payment' ? resourceId : null

    switch (topic) {
      case 'payment':
        const paymentDetails = paymentId ? await getPaymentDetails(String(paymentId)) : null
        const paymentStatus = paymentDetails?.status || raw.status
        const externalReference = paymentDetails?.external_reference || raw.external_reference

        await handlePaymentUpdate({
          deliveryKey,
          paymentId: String(paymentId),
          status: String(paymentStatus || 'pending'),
          externalReference: externalReference ? String(externalReference) : undefined,
          paymentDetails,
        })
        break

      case 'merchant_order':
        await updateWebhookEvent(deliveryKey, {
          status: 'ignored',
          processedAt: new Date(),
        })
        break

      default:
        await updateWebhookEvent(deliveryKey, {
          status: 'ignored',
          processedAt: new Date(),
        })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    captureException(error, { context: 'webhook.mercadopago', detail: 'POST handler failed' })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handlePaymentUpdate(input: {
  deliveryKey: string
  paymentId: string
  status: string
  externalReference?: string
  paymentDetails?: MercadoPagoWebhookPayment | null
}) {
  if (!input.externalReference) {
    await updateWebhookEvent(input.deliveryKey, {
      status: 'ignored',
      processedAt: new Date(),
      paymentId: input.paymentId,
      lastError: 'missing_external_reference',
    })
    return
  }

  const order = await getOrderByNumber(input.externalReference)
  if (!order) {
    await updateWebhookEvent(input.deliveryKey, {
      status: 'failed',
      processedAt: new Date(),
      orderNumber: input.externalReference,
      paymentId: input.paymentId,
      lastError: 'order_not_found',
    })
    return
  }

  const mapped = mapMercadoPagoStatus(input.status)
  const resolved = resolvePaymentTransition(order.paymentStatus, order.status, mapped)

  const updated = await updateOrderPaymentByNumber(order.orderNumber, {
    status: resolved.orderStatus,
    paymentStatus: resolved.paymentStatus,
    provider: 'mercadopago',
    method: input.paymentDetails?.payment_method_id === 'pix' ? 'pix' : 'card',
    amount: typeof input.paymentDetails?.transaction_amount === 'number' ? input.paymentDetails.transaction_amount : undefined,
    providerPaymentId: input.paymentId,
    pixQrCodeBase64: input.paymentDetails?.point_of_interaction?.transaction_data?.qr_code_base64 || null,
    pixCopyPaste: input.paymentDetails?.point_of_interaction?.transaction_data?.qr_code || null,
    checkoutUrl: input.paymentDetails?.transaction_details?.external_resource_url || null,
    rawPayload: input.paymentDetails
      ? {
          ...input.paymentDetails,
          paidAt: input.paymentDetails.date_approved || null,
        }
      : null,
  })

  await updateWebhookEvent(input.deliveryKey, {
    status: updated ? 'processed' : 'failed',
    processedAt: new Date(),
    orderNumber: order.orderNumber,
    paymentId: input.paymentId,
    lastError: updated ? null : 'payment_update_failed',
  })

  if (!resolved.shouldPersistStatus) {
    console.info(`Webhook ${input.deliveryKey} received duplicate or regressive status ${input.status} for order ${order.orderNumber}.`)
  }

  if (updated && resolved.shouldPersistStatus && mapped.paymentStatus === 'paid') {
    try {
      const result = await ensureProductionTasksForOrder(order.id)
      console.info(`[webhook] production tasks ensured for ${order.orderNumber}: created=${result.created}`)
    } catch (err) {
      captureException(err, {
        context: 'webhook.mercadopago',
        detail: 'ensureProductionTasksForOrder failed',
        orderNumber: order.orderNumber,
      })
    }
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Mercado Pago webhook endpoint' })
}
