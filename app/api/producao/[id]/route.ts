import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import {
  getProductionTask,
  updateProductionTask,
  DatabaseUnavailableError,
} from '@/lib/database'
import { captureException } from '@/lib/observability'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import {
  cancelProductionTaskOnly,
  cancelOrderItemViaProduction,
  cancelEntireOrderViaProduction,
  type CancelMode,
} from '@/lib/production-cancel'

export const dynamic = 'force-dynamic'

const VALID_STATUS = ['pending', 'in_production', 'paused', 'completed', 'cancelled'] as const
const VALID_PRIORITY = ['low', 'normal', 'high', 'urgent'] as const

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID da tarefa é obrigatório.' }, { status: 400 })
    }
    const task = await getProductionTask(id)
    if (!task) {
      return NextResponse.json({ error: 'Tarefa de produção não encontrada.' }, { status: 404 })
    }
    return NextResponse.json(task)
  } catch (error) {
    captureException(error, { context: 'api.producao.[id]', detail: 'GET getProductionTask failed' })
    return NextResponse.json({ error: 'Erro ao buscar tarefa de produção.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID da tarefa é obrigatório.' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const input: {
      producedQuantity?: number
      quantityDelta?: number
      status?: 'pending' | 'in_production' | 'paused' | 'completed' | 'cancelled'
      priority?: 'low' | 'normal' | 'high' | 'urgent'
      dueAt?: string | null
      notes?: string | null
      note?: string
    } = {}

    if (body.producedQuantity !== undefined) {
      if (typeof body.producedQuantity !== 'number' || !Number.isFinite(body.producedQuantity)) {
        return NextResponse.json(
          { error: 'producedQuantity deve ser um número finito.' },
          { status: 400 }
        )
      }
      input.producedQuantity = body.producedQuantity
    }

    if (body.quantityDelta !== undefined) {
      if (typeof body.quantityDelta !== 'number' || !Number.isFinite(body.quantityDelta)) {
        return NextResponse.json(
          { error: 'quantityDelta deve ser um número finito.' },
          { status: 400 }
        )
      }
      input.quantityDelta = body.quantityDelta
    }

    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !VALID_STATUS.includes(body.status as any)) {
        return NextResponse.json(
          { error: `Status inválido. Use um de: ${VALID_STATUS.join(', ')}.` },
          { status: 400 }
        )
      }
      input.status = body.status
    }

    if (body.priority !== undefined) {
      if (typeof body.priority !== 'string' || !VALID_PRIORITY.includes(body.priority as any)) {
        return NextResponse.json(
          { error: `Prioridade inválida. Use uma de: ${VALID_PRIORITY.join(', ')}.` },
          { status: 400 }
        )
      }
      input.priority = body.priority
    }

    if (body.dueAt !== undefined) {
      if (body.dueAt === null) {
        input.dueAt = null
      } else if (typeof body.dueAt === 'string') {
        const d = new Date(body.dueAt)
        if (d.toString() === 'Invalid Date') {
          return NextResponse.json(
            { error: 'dueAt deve ser uma data ISO válida ou null.' },
            { status: 400 }
          )
        }
        input.dueAt = body.dueAt
      } else {
        return NextResponse.json(
          { error: 'dueAt deve ser uma string ISO ou null.' },
          { status: 400 }
        )
      }
    }

    if (body.notes !== undefined) {
      if (body.notes === null || typeof body.notes === 'string') {
        input.notes = body.notes
      } else {
        return NextResponse.json(
          { error: 'notes deve ser uma string ou null.' },
          { status: 400 }
        )
      }
    }

    if (body.note !== undefined) {
      if (typeof body.note !== 'string') {
        return NextResponse.json({ error: 'note deve ser uma string.' }, { status: 400 })
      }
      input.note = body.note
    }

    const result = await updateProductionTask(id, input, {
      email: auth.user!.email,
      name: auth.user!.name,
    })

    if (!result.ok) {
      const status = /não encontrada/i.test(result.error) ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json(result.task)
  } catch (error) {
    captureException(error, { context: 'api.producao.[id]', detail: 'PATCH updateProductionTask failed' })
    return NextResponse.json({ error: 'Erro ao atualizar tarefa de produção.' }, { status: 500 })
  }
}

/**
 * SPEC-005 Fase 2b — DELETE /api/producao/[id]?mode=TASK_ONLY|ITEM_ONLY|ORDER
 *
 * 3 modos de remocao com semanticas diferentes:
 * - TASK_ONLY: cancela apenas a ProductionTask. OrderItem e Order intactos.
 * - ITEM_ONLY: + soft-deleta OrderItem + recalcula Order.total + paidAmount.
 *              Se virou refundDue > 0, marca Order.refundStatus='manual_required'.
 * - ORDER: + soft-deleta TODOS os items + cancela TODAS as tasks +
 *          Order.status='cancelled'. Refund manual se pago > 0.
 *
 * Sempre exige `?reason=...` (min 5 chars). AuditLog grava modo + reason +
 * snapshot dos totals.
 */
const VALID_MODES: CancelMode[] = ['TASK_ONLY', 'ITEM_ONLY', 'ORDER']

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'ID da tarefa é obrigatório.' }, { status: 400 })
  }

  const url = new URL(request.url)
  const modeParam = url.searchParams.get('mode') || ''
  if (!VALID_MODES.includes(modeParam as CancelMode)) {
    return NextResponse.json(
      { error: `mode obrigatorio (${VALID_MODES.join(' | ')})` },
      { status: 400 },
    )
  }
  const mode = modeParam as CancelMode

  let reason = url.searchParams.get('reason') || ''
  if (!reason) {
    const body = await request.json().catch(() => null)
    if (body && typeof body.reason === 'string') {
      reason = body.reason
    }
  }
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json(
      { error: 'reason obrigatorio (minimo 5 caracteres)' },
      { status: 400 },
    )
  }

  try {
    let result
    if (mode === 'TASK_ONLY') {
      result = await cancelProductionTaskOnly(id)
    } else if (mode === 'ITEM_ONLY') {
      result = await cancelOrderItemViaProduction(id)
    } else {
      result = await cancelEntireOrderViaProduction(id)
    }

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: `production.cancel.${mode.toLowerCase()}`,
      targetType: 'ProductionTask',
      targetId: id,
      summary: `Pedido ${result.orderNumber}: cancelamento via producao (${mode}) — ${reason.slice(0, 100)}`,
      metadata: {
        mode,
        reason: reason.slice(0, 500),
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        productionTaskId: id,
        itemsCancelled: result.itemsCancelled,
        ...(result.refundDue ? { refundDue: result.refundDue } : {}),
      },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    if (error instanceof Error) {
      const status = /nao encontrada|não encontrada/i.test(error.message) ? 404 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    captureException(error, { context: 'api.producao.[id]', detail: 'DELETE cancel failed' })
    return NextResponse.json({ error: 'Erro ao cancelar.' }, { status: 500 })
  }
}
