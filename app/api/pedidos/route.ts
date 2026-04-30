import { NextRequest, NextResponse } from 'next/server'
import { createOrder, deleteOrder, listOrders, updateOrder } from '@/lib/database'

export async function GET() {
  return NextResponse.json(await listOrders())
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newOrder = await createOrder(body)
  return NextResponse.json(newOrder, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { id, ...data } = await request.json()
  const order = await updateOrder(id, data)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id || !(await deleteOrder(id))) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
