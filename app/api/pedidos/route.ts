import { NextRequest, NextResponse } from 'next/server'
import {
  createOrder,
  deleteOrder,
  getOrderByIdOrNumber,
  listOrders,
  updateOrder,
} from '@/lib/database'
import { requireApiAdmin } from '@/lib/api-auth'
import { notifyOrderStatusChange } from '@/lib/order-notifications'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  return NextResponse.json(await listOrders())
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const body = await request.json()
  const newOrder = await createOrder(body)
  return NextResponse.json(newOrder, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id, ...data } = await request.json()

  const before = id ? await getOrderByIdOrNumber(id) : null

  const order = await updateOrder(id, data)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Best-effort customer notifications when admin changes status. Wrapped in
  // its own try/catch inside notifyOrderStatusChange — never blocks the
  // response.
  if (before) {
    notifyOrderStatusChange(
      {
        orderNumber: before.orderNumber,
        customerName: before.customerName,
        customerEmail: before.customerEmail,
        total: before.total,
        trackingCode: before.trackingCode,
        status: before.status,
        paymentStatus: before.paymentStatus,
        fulfillmentStatus: before.fulfillmentStatus,
        items: before.items.map(it => ({ productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice })),
      },
      {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        total: order.total,
        trackingCode: order.trackingCode,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        items: (order.items || []).map(it => ({ productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice })),
      },
    ).catch(() => {})
  }

  return NextResponse.json(order)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id || !(await deleteOrder(id))) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
