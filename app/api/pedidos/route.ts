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
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import {
  getNextStage,
  getPreviousStage,
  withTimelineStamp,
  type ProductionTimeline,
  type FulfillmentStatus,
} from '@/lib/order-statuses'

async function validateOrderItems(
  items: Array<{ productId: string; variantId?: string | null }> | undefined,
): Promise<NextResponse | null> {
  if (!items || items.length === 0) return null
  if (!prisma?.product) return null

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { variants: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produto inexistente' }, { status: 400 })
    }
    if (product.variants.length > 0 && !item.variantId) {
      return NextResponse.json(
        { error: `Selecione uma variação para ${product.name}` },
        { status: 400 },
      )
    }
    if (item.variantId) {
      const variant = product.variants.find(v => v.id === item.variantId)
      if (!variant) {
        return NextResponse.json({ error: 'Variação inválida' }, { status: 400 })
      }
    }
  }
  return null
}

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  return NextResponse.json(await listOrders())
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const body = await request.json()
  const itemsError = await validateOrderItems(body.items)
  if (itemsError) return itemsError
  const newOrder = await createOrder(body)
  return NextResponse.json(newOrder, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const body = await request.json()
  const { id, action, currentStageNote, ...rest } = body as {
    id?: string
    action?: 'advance_stage' | 'regress_stage'
    currentStageNote?: string | null
    [key: string]: unknown
  }

  if (action === 'advance_stage' || action === 'regress_stage') {
    return handleStageTransition({
      request,
      auth,
      id: id || '',
      action,
      currentStageNote: typeof currentStageNote === 'string' ? currentStageNote : null,
    })
  }

  const data = rest as Record<string, unknown>
  const itemsError = await validateOrderItems(data.items as Array<{ productId: string; variantId?: string | null }> | undefined)
  if (itemsError) return itemsError

  const before = id ? await getOrderByIdOrNumber(id) : null

  const order = await updateOrder(id || '', data)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (before) {
    const fields: string[] = []
    if (before.paymentStatus !== order.paymentStatus) fields.push(`pagamento ${before.paymentStatus}→${order.paymentStatus}`)
    if (before.fulfillmentStatus !== order.fulfillmentStatus) fields.push(`fulfillment ${before.fulfillmentStatus}→${order.fulfillmentStatus}`)
    if (before.trackingCode !== order.trackingCode && order.trackingCode) fields.push(`tracking definido`)
    if (fields.length > 0) {
      recordAuditEntry({
        actorEmail: auth.user!.email,
        actorRole: auth.user!.role || null,
        action: 'order.update',
        targetType: 'Order',
        targetId: order.id,
        summary: `Pedido ${order.orderNumber}: ${fields.join('; ')}`,
        metadata: {
          orderNumber: order.orderNumber,
          before: { paymentStatus: before.paymentStatus, fulfillmentStatus: before.fulfillmentStatus, trackingCode: before.trackingCode },
          after: { paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, trackingCode: order.trackingCode },
        },
        ip: getClientIp(request),
      }).catch(() => {})
    }
  }

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

async function handleStageTransition(input: {
  request: NextRequest
  auth: Awaited<ReturnType<typeof requireApiAdmin>>
  id: string
  action: 'advance_stage' | 'regress_stage'
  currentStageNote: string | null
}): Promise<NextResponse> {
  const { request, auth, id, action, currentStageNote } = input

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  }

  const before = await getOrderByIdOrNumber(id)
  if (!before) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const target =
    action === 'advance_stage'
      ? getNextStage(before.fulfillmentStatus)
      : getPreviousStage(before.fulfillmentStatus)

  if (!target) {
    return NextResponse.json(
      {
        error:
          action === 'advance_stage'
            ? 'Pedido já está na última fase ou não pode avançar'
            : 'Pedido não pode regredir desta fase',
      },
      { status: 400 },
    )
  }

  const currentTimeline =
    (before as unknown as { productionTimeline?: ProductionTimeline | null }).productionTimeline || null
  const nextTimeline = withTimelineStamp(currentTimeline, target as FulfillmentStatus)

  const updated = await updateOrder(before.id, {
    fulfillmentStatus: target,
    productionTimeline: nextTimeline,
    currentStageNote: currentStageNote ?? null,
  } as Parameters<typeof updateOrder>[1])

  if (!updated) {
    return NextResponse.json({ error: 'Falha ao atualizar pedido' }, { status: 500 })
  }

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: action === 'advance_stage' ? 'order.advance_stage' : 'order.regress_stage',
    targetType: 'Order',
    targetId: updated.id,
    summary: `Pedido ${updated.orderNumber}: ${before.fulfillmentStatus} → ${target}${currentStageNote ? ` (nota: ${currentStageNote.slice(0, 100)})` : ''}`,
    metadata: {
      orderNumber: updated.orderNumber,
      from: before.fulfillmentStatus,
      to: target,
      note: currentStageNote || null,
    },
    ip: getClientIp(request),
  }).catch(() => {})

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
      orderNumber: updated.orderNumber,
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      total: updated.total,
      trackingCode: updated.trackingCode,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      fulfillmentStatus: updated.fulfillmentStatus,
      items: (updated.items || []).map(it => ({ productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice })),
    },
  ).catch(() => {})

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Order id is required' }, { status: 400 })
  const before = await getOrderByIdOrNumber(id)

  if (!(await deleteOrder(id))) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (before) {
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'order.delete',
      targetType: 'Order',
      targetId: before.id,
      summary: `Pedido ${before.orderNumber} excluído`,
      metadata: { orderNumber: before.orderNumber, customerEmail: before.customerEmail, total: before.total },
      ip: getClientIp(request),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
