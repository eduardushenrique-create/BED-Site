import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { listOrdersByCustomerEmail } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const result = await listOrdersByCustomerEmail(auth.user!.email, {
    status,
    limit: Number.isFinite(limit) ? limit : 20,
    offset: Number.isFinite(offset) ? offset : 0,
  })

  return NextResponse.json({
    orders: result.orders.map(order => ({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      total: order.total,
      itemCount: order.items.length,
      trackingCode: order.trackingCode,
      createdAt: order.createdAt,
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  })
}
