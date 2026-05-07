import { NextRequest, NextResponse } from 'next/server'
import {
  deleteOrder,
  getOrderByIdOrNumber,
  updateOrder,
} from '@/lib/database'
import { requireApiAdmin } from '@/lib/api-auth'
import { notifyOrderStatusChange } from '@/lib/order-notifications'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
} from '@/lib/order-statuses'
import { triggerProductionTasksOnStatusChange } from '@/lib/order-production-bridge'

export const dynamic = 'force-dynamic'

const MAX_BULK_IDS = 100

type BulkAction = 'update' | 'delete'

type BulkPayload = {
  fulfillmentStatus?: string
  paymentStatus?: string
  currentStageNote?: string | null
}

type BulkBody = {
  orderIds?: unknown
  action?: unknown
  payload?: unknown
}

type BulkFailure = { id: string; error: string }

const FULFILLMENT_VALUES = new Set<string>(FULFILLMENT_STATUSES.map(s => s.value))
const PAYMENT_VALUES = new Set<string>(PAYMENT_STATUSES.map(s => s.value))

function validatePayload(payload: unknown): { ok: true; data: BulkPayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Informe um payload com pelo menos um campo (fulfillmentStatus, paymentStatus ou currentStageNote).' }
  }

  const raw = payload as Record<string, unknown>
  const out: BulkPayload = {}

  if (raw.fulfillmentStatus !== undefined) {
    if (typeof raw.fulfillmentStatus !== 'string' || !FULFILLMENT_VALUES.has(raw.fulfillmentStatus)) {
      return { ok: false, error: 'fulfillmentStatus inválido.' }
    }
    out.fulfillmentStatus = raw.fulfillmentStatus
  }

  if (raw.paymentStatus !== undefined) {
    if (typeof raw.paymentStatus !== 'string' || !PAYMENT_VALUES.has(raw.paymentStatus)) {
      return { ok: false, error: 'paymentStatus inválido.' }
    }
    out.paymentStatus = raw.paymentStatus
  }

  if (raw.currentStageNote !== undefined) {
    if (raw.currentStageNote !== null && typeof raw.currentStageNote !== 'string') {
      return { ok: false, error: 'currentStageNote deve ser string ou null.' }
    }
    out.currentStageNote = (raw.currentStageNote as string | null) ?? null
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, error: 'Informe pelo menos um campo a alterar (fulfillmentStatus, paymentStatus ou currentStageNote).' }
  }

  return { ok: true, data: out }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const body = (await request.json().catch(() => null)) as BulkBody | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
  const action = body.action as BulkAction | undefined

  if (orderIds.length === 0) {
    return NextResponse.json({ error: 'orderIds deve ser um array não vazio.' }, { status: 400 })
  }
  if (orderIds.length > MAX_BULK_IDS) {
    return NextResponse.json(
      { error: `Limite de ${MAX_BULK_IDS} pedidos por operação. Selecione menos itens.` },
      { status: 400 },
    )
  }
  if (action !== 'update' && action !== 'delete') {
    return NextResponse.json({ error: 'action deve ser "update" ou "delete".' }, { status: 400 })
  }

  // Deduplicar IDs preservando ordem
  const seen = new Set<string>()
  const uniqueIds: string[] = []
  for (const id of orderIds) {
    if (!seen.has(id)) {
      seen.add(id)
      uniqueIds.push(id)
    }
  }

  let payload: BulkPayload | null = null
  if (action === 'update') {
    const validated = validatePayload(body.payload)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }
    payload = validated.data
  }

  const ip = getClientIp(request)
  const failed: BulkFailure[] = []
  let succeeded = 0

  if (action === 'delete') {
    for (const id of uniqueIds) {
      try {
        const before = await getOrderByIdOrNumber(id)
        if (!before) {
          failed.push({ id, error: 'Pedido não encontrado.' })
          continue
        }
        const ok = await deleteOrder(before.id)
        if (!ok) {
          failed.push({ id, error: 'Falha ao excluir.' })
          continue
        }
        succeeded += 1
        recordAuditEntry({
          actorEmail: auth.user!.email,
          actorRole: auth.user!.role || null,
          action: 'order.delete',
          targetType: 'Order',
          targetId: before.id,
          summary: `Pedido ${before.orderNumber} excluído (operação em massa)`,
          metadata: {
            orderNumber: before.orderNumber,
            customerEmail: before.customerEmail,
            total: before.total,
            bulk: true,
          },
          ip,
        }).catch(() => {})
      } catch (error) {
        failed.push({ id, error: error instanceof Error ? error.message : 'Erro desconhecido.' })
      }
    }
  } else if (action === 'update' && payload) {
    for (const id of uniqueIds) {
      try {
        const before = await getOrderByIdOrNumber(id)
        if (!before) {
          failed.push({ id, error: 'Pedido não encontrado.' })
          continue
        }

        const updated = await updateOrder(before.id, payload as Parameters<typeof updateOrder>[1])
        if (!updated) {
          failed.push({ id, error: 'Falha ao atualizar.' })
          continue
        }
        succeeded += 1

        // Mesma garantia do PUT individual (app/api/pedidos/route.ts): se a
        // operacao em massa moveu o pedido para uma fase de producao, gera
        // as ProductionTask. Idempotente, nao bloqueia a transicao em caso
        // de falha (bridge captura excecoes internamente).
        if (
          payload?.fulfillmentStatus &&
          before.fulfillmentStatus !== updated.fulfillmentStatus
        ) {
          await triggerProductionTasksOnStatusChange(
            {
              id: updated.id,
              fulfillmentStatus: updated.fulfillmentStatus,
              status: updated.status,
              orderNumber: updated.orderNumber,
            },
            before.fulfillmentStatus,
          ).catch(() => {})
        }

        const fields: string[] = []
        if (before.paymentStatus !== updated.paymentStatus) fields.push(`pagamento ${before.paymentStatus}->${updated.paymentStatus}`)
        if (before.fulfillmentStatus !== updated.fulfillmentStatus) fields.push(`fulfillment ${before.fulfillmentStatus}->${updated.fulfillmentStatus}`)

        if (fields.length > 0) {
          recordAuditEntry({
            actorEmail: auth.user!.email,
            actorRole: auth.user!.role || null,
            action: 'order.update',
            targetType: 'Order',
            targetId: updated.id,
            summary: `Pedido ${updated.orderNumber}: ${fields.join('; ')} (operação em massa)`,
            metadata: {
              orderNumber: updated.orderNumber,
              before: {
                paymentStatus: before.paymentStatus,
                fulfillmentStatus: before.fulfillmentStatus,
              },
              after: {
                paymentStatus: updated.paymentStatus,
                fulfillmentStatus: updated.fulfillmentStatus,
              },
              bulk: true,
            },
            ip,
          }).catch(() => {})
        }

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
      } catch (error) {
        failed.push({ id, error: error instanceof Error ? error.message : 'Erro desconhecido.' })
      }
    }
  }

  // Audit log agregado da operação em massa
  const summaryAction = action === 'delete' ? 'exclusão' : 'atualização'
  const payloadSummary = action === 'update' && payload
    ? Object.entries(payload)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v ?? 'null'}`)
        .join(', ')
    : ''

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: action === 'delete' ? 'order.bulk_delete' : 'order.bulk_update',
    targetType: 'Order',
    targetId: null,
    summary: `Operação em massa: ${summaryAction} em ${succeeded}/${uniqueIds.length} pedidos${payloadSummary ? ` (${payloadSummary})` : ''}`,
    metadata: {
      action,
      payload: payload || null,
      total: uniqueIds.length,
      succeeded,
      failed: failed.length,
      orderIds: uniqueIds,
    },
    ip,
  }).catch(() => {})

  return NextResponse.json({
    total: uniqueIds.length,
    succeeded,
    failed,
  })
}
