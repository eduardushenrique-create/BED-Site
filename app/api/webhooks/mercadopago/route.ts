import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/mercadopago'

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-signature')
    const payload = await request.text()

    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET

    if (webhookSecret && !verifyWebhookSignature(signature, payload, webhookSecret)) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const data = JSON.parse(payload)

    const topic = data.type || data.topic
    const paymentId = data.data?.id || data.id

    console.log(`Mercado Pago webhook received: ${topic} - ${paymentId}`)

    switch (topic) {
      case 'payment':
        const paymentStatus = data.status
        const externalReference = data.external_reference

        console.log(`Payment ${paymentId} status: ${paymentStatus}`)
        console.log(`External reference: ${externalReference}`)

        await handlePaymentUpdate(paymentId, paymentStatus, externalReference)
        break

      case 'merchant_order':
        console.log('Merchant order received:', data.id)
        break

      default:
        console.log(`Unhandled webhook type: ${topic}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handlePaymentUpdate(
  paymentId: string,
  status: string,
  externalReference?: string
) {
  console.log(`Updating payment ${paymentId} to status: ${status}`)

  if (!externalReference) {
    console.warn('No external reference found for payment:', paymentId)
    return
  }

  const orderNumber = externalReference
  console.log(`Order to update: ${orderNumber}`)

  switch (status) {
    case 'approved':
    case 'accredited':
      console.log(`Payment approved for order ${orderNumber}`)
      break

    case 'pending':
    case 'in_process':
      console.log(`Payment pending for order ${orderNumber}`)
      break

    case 'rejected':
      console.log(`Payment rejected for order ${orderNumber}`)
      break

    case 'cancelled':
      console.log(`Payment cancelled for order ${orderNumber}`)
      break

    case 'refunded':
      console.log(`Payment refunded for order ${orderNumber}`)
      break

    default:
      console.log(`Unknown payment status: ${status}`)
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Mercado Pago webhook endpoint' })
}