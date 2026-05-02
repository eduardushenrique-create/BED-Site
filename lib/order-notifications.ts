import 'server-only'

import {
  sendOrderDelivered,
  sendOrderInProduction,
  sendOrderRefunded,
  sendOrderShipped,
  sendPaymentApproved,
} from '@/lib/email'
import { captureException } from '@/lib/observability'

export type OrderSnapshot = {
  orderNumber: string
  customerName: string
  customerEmail: string
  total: number
  trackingCode: string | null
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
  }>
}

export type OrderStatusDiff = {
  paymentStatusChanged?: boolean
  fulfillmentStatusChanged?: boolean
  trackingCodeAdded?: boolean
}

/**
 * Sends customer-facing notifications for status transitions. Best-effort:
 * any failure is captured to Sentry but never thrown.
 *
 * Idempotency: callers must compute the diff against the previous state.
 * This function only fires when the relevant field actually changed value.
 */
export async function notifyOrderStatusChange(
  before: OrderSnapshot | null,
  after: OrderSnapshot,
): Promise<void> {
  if (!after.customerEmail) return
  const previous = before || ({} as Partial<OrderSnapshot>)

  const paymentChanged = previous.paymentStatus !== after.paymentStatus
  const fulfillmentChanged = previous.fulfillmentStatus !== after.fulfillmentStatus
  const trackingAdded = !!after.trackingCode && previous.trackingCode !== after.trackingCode

  try {
    if (paymentChanged && after.paymentStatus === 'paid') {
      await sendPaymentApproved({
        orderNumber: after.orderNumber,
        customerName: after.customerName,
        customerEmail: after.customerEmail,
        items: after.items.map(i => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice })),
        total: after.total,
      })
    }

    if (paymentChanged && after.paymentStatus === 'refunded') {
      await sendOrderRefunded(after.customerEmail, after.customerName, after.orderNumber, after.total)
    }

    if (fulfillmentChanged && after.fulfillmentStatus === 'in_production') {
      await sendOrderInProduction(after.customerEmail, after.customerName, after.orderNumber)
    }

    // Notify shipped only if the change happened here (not via the ME webhook,
    // which already emails). We detect that by combining the fulfillment change
    // with a tracking code being newly set.
    if (
      fulfillmentChanged &&
      after.fulfillmentStatus === 'shipped' &&
      after.trackingCode
    ) {
      await sendOrderShipped(after.customerEmail, after.orderNumber, after.trackingCode)
    } else if (
      trackingAdded &&
      after.fulfillmentStatus === 'shipped' &&
      previous.fulfillmentStatus === 'shipped' &&
      after.trackingCode
    ) {
      // Edge: order was already 'shipped' but the admin only just added the
      // tracking code. Customer hasn't been notified yet — send now.
      await sendOrderShipped(after.customerEmail, after.orderNumber, after.trackingCode)
    }

    if (fulfillmentChanged && after.fulfillmentStatus === 'delivered') {
      await sendOrderDelivered(after.customerEmail, after.orderNumber)
    }
  } catch (error) {
    captureException(error, {
      context: 'order-notifications.notifyOrderStatusChange',
      orderNumber: after.orderNumber,
    })
  }
}
