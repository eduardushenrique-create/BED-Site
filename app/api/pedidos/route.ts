import { NextRequest, NextResponse } from 'next/server'
import {
  createOrder,
  deleteOrder,
  getOrderByIdOrNumber,
  listOrders,
  updateOrder,
  DatabaseUnavailableError,
} from '@/lib/database'
import { requireApiAdmin } from '@/lib/api-auth'
import { notifyOrderStatusChange } from '@/lib/order-notifications'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import {
  getNextStage,
  getOrderTypeFromOrder,
  getPreviousStage,
  withTimelineStamp,
  type DeliveryMethod,
  type FulfillmentStatus,
  type ProductionTimeline,
} from '@/lib/order-statuses'
import {
  triggerProductionTasksOnStatusChange,
  type TriggerProductionResult,
} from '@/lib/order-production-bridge'

/**
 * Converte o resultado do bridge em um payload limpo para o response e em
 * um snippet de metadata para o audit log. Mantém o handler enxuto.
 */
function summarizeProductionTrigger(result: TriggerProductionResult) {
  if (!result.triggered) {
    return { responsePayload: null, auditMetadata: null }
  }
  const responsePayload: Record<string, unknown> = { tasksCreated: result.created }
  if (result.skipped) responsePayload.warning = result.skipped
  if (result.unpaid) responsePayload.unpaid = true
  if (result.error) responsePayload.error = true

  const auditMetadata: Record<string, unknown> = { created: result.created }
  if (result.skipped) auditMetadata.skipped = result.skipped
  if (result.unpaid) auditMetadata.unpaid = true
  if (result.error) auditMetadata.error = true

  return { responsePayload, auditMetadata }
}

/**
 * Valida o desconto manual aplicado pelo admin na criacao do pedido.
 * O backend e a fonte da verdade: recalcula a partir de kind+input e ignora
 * o `discountTotal` cru do cliente quando dados suficientes vierem. Cap em
 * subtotal+frete pra impedir total negativo.
 *
 * Retorna { error } com mensagem amigavel quando rejeita, ou
 * { normalized } com os valores autoritativos pra persistir.
 */
function validateDiscount(body: {
  subtotal?: unknown
  shippingCost?: unknown
  discountTotal?: unknown
  discountKind?: unknown
  discountInput?: unknown
  discountReason?: unknown
}): {
  error?: string
  normalized: {
    discountTotal: number
    reason: string | null
    kind: 'fixed' | 'percentage' | null
    input: number | null
  }
} {
  const empty = {
    normalized: { discountTotal: 0, reason: null, kind: null, input: null },
  } as const

  const subtotal = Number(body.subtotal) || 0
  const shipping = Number(body.shippingCost) || 0
  const requested = Number(body.discountTotal) || 0
  if (requested === 0) return empty

  if (requested < 0) {
    return { error: 'Desconto nao pode ser negativo', ...empty }
  }

  const kind =
    body.discountKind === 'percentage' || body.discountKind === 'fixed'
      ? body.discountKind
      : null
  const input =
    typeof body.discountInput === 'number' && Number.isFinite(body.discountInput)
      ? body.discountInput
      : null

  let canonical = requested
  if (kind === 'percentage' && input !== null) {
    if (input < 0 || input > 100) {
      return { error: 'Percentual de desconto deve estar entre 0 e 100', ...empty }
    }
    canonical = Math.min(subtotal, (subtotal * input) / 100)
  } else if (kind === 'fixed' && input !== null) {
    if (input < 0) {
      return { error: 'Valor de desconto nao pode ser negativo', ...empty }
    }
    canonical = Math.min(subtotal + shipping, input)
  }

  if (canonical > subtotal + shipping) {
    return { error: 'Desconto maior que subtotal + frete', ...empty }
  }

  const reasonRaw = typeof body.discountReason === 'string' ? body.discountReason.trim() : ''
  return {
    normalized: {
      discountTotal: Math.round(Math.max(0, canonical) * 100) / 100,
      reason: reasonRaw ? reasonRaw.slice(0, 200) : null,
      kind,
      input,
    },
  }
}

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

  // Validacao de desconto manual. Server-side e a fonte da verdade — o cliente
  // pode mandar `total` calculado, mas a gente recalcula a partir do subtotal
  // e do desconto autoritativo pra impedir adulteracao.
  const discount = validateDiscount(body)
  if (discount.error) {
    return NextResponse.json({ error: discount.error }, { status: 400 })
  }
  const subtotal = Number(body.subtotal) || 0
  const shipping = Number(body.shippingCost) || 0
  const authoritativeTotal = Math.max(
    0,
    Math.round((subtotal + shipping - discount.normalized.discountTotal) * 100) / 100,
  )

  try {
    const newOrder = await createOrder({
      ...body,
      discountTotal: discount.normalized.discountTotal,
      discountReason: discount.normalized.reason,
      discountKind: discount.normalized.kind,
      discountInput: discount.normalized.input,
      discountAppliedBy: discount.normalized.discountTotal > 0 ? auth.user?.email || null : null,
      total: authoritativeTotal,
    })

    // Audit log de criacao do pedido. Registrar mesmo quando nao tem desconto
    // ajuda a fiscalizar quem criou cada pedido manual (resposta do stakeholder
    // sobre rastreabilidade do atendimento).
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'order.create',
      targetType: 'Order',
      targetId: newOrder.id,
      summary:
        discount.normalized.discountTotal > 0
          ? `Pedido ${newOrder.orderNumber} criado com desconto manual de R$ ${discount.normalized.discountTotal.toFixed(2)}${discount.normalized.reason ? ` (${discount.normalized.reason})` : ''}`
          : `Pedido ${newOrder.orderNumber} criado manualmente`,
      metadata: {
        orderNumber: newOrder.orderNumber,
        customerEmail: newOrder.customerEmail,
        subtotal,
        shipping,
        total: authoritativeTotal,
        ...(discount.normalized.discountTotal > 0
          ? {
              discount: {
                total: discount.normalized.discountTotal,
                kind: discount.normalized.kind,
                input: discount.normalized.input,
                reason: discount.normalized.reason,
              },
            }
          : {}),
      },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json(newOrder, { status: 201 })
  } catch (error) {
    // Quando o banco está fora em produção, createOrder lança em vez de
    // gravar no fallback localDb volátil (vide incidente de 2026-05-13).
    // Retornar 503 explícito faz o admin ver "tente de novo" em vez de
    // uma falsa confirmação que some no próximo deploy.
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    throw error
  }
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

  // Edição manual de fulfillmentStatus também precisa criar tasks de produção
  // quando o pedido entra em "Em produção" (cobre admin que pula etapas via
  // formulário de edição direta, sem usar o botão "avançar fase").
  const productionTrigger = before
    ? await triggerProductionTasksOnStatusChange(
        {
          id: order.id,
          fulfillmentStatus: order.fulfillmentStatus,
          status: order.status,
          orderNumber: order.orderNumber,
        },
        before.fulfillmentStatus,
      )
    : ({ triggered: false } as TriggerProductionResult)
  const { responsePayload: productionPayload, auditMetadata: productionAudit } =
    summarizeProductionTrigger(productionTrigger)

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
          ...(productionAudit ? { production: productionAudit } : {}),
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

  return NextResponse.json(
    productionPayload ? { ...order, production: productionPayload } : order,
  )
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

  // Pipeline depende do tipo de pedido (sob encomenda vs pronta entrega) e do
  // metodo de entrega (correio vs retirada). Os helpers retornam diferentes
  // proximas fases conforme essas dimensoes.
  // getOrderTypeFromOrder le do campo persistido `Order.orderType` (preferido)
  // e cai no fallback de derivar pelos items se o campo nao estiver populado.
  const stageOptions = {
    type: getOrderTypeFromOrder(before as Parameters<typeof getOrderTypeFromOrder>[0]),
    deliveryMethod: ((before as unknown as { deliveryMethod?: string | null })
      .deliveryMethod || 'shipping') as DeliveryMethod,
  }

  const target =
    action === 'advance_stage'
      ? getNextStage(before.fulfillmentStatus, stageOptions)
      : getPreviousStage(before.fulfillmentStatus, stageOptions)

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

  // Quando o pedido entra em "Em produção", garante que existam as
  // ProductionTask correspondentes para os itens elegíveis. Idempotente,
  // não bloqueia a transição em caso de falha.
  const productionTrigger = await triggerProductionTasksOnStatusChange(
    {
      id: updated.id,
      fulfillmentStatus: updated.fulfillmentStatus,
      status: updated.status,
      orderNumber: updated.orderNumber,
    },
    before.fulfillmentStatus,
  )
  const { responsePayload: productionPayload, auditMetadata: productionAudit } =
    summarizeProductionTrigger(productionTrigger)

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
      ...(productionAudit ? { production: productionAudit } : {}),
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

  return NextResponse.json(
    productionPayload ? { ...updated, production: productionPayload } : updated,
  )
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
