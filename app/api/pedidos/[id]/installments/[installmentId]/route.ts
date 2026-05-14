import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { DatabaseUnavailableError } from '@/lib/database'
import {
  updateInstallment,
  softDeleteInstallment,
} from '@/lib/installments'

/**
 * SPEC-005 Fase 2a — PATCH/DELETE de PaymentInstallment individual.
 *
 * - PATCH  /api/pedidos/[id]/installments/[installmentId] -> edita
 * - DELETE /api/pedidos/[id]/installments/[installmentId] -> soft-delete
 *
 * R25 do ADR-003 v2: rate limit em DELETE eh feito a nivel de proxy/
 * middleware (nao implementado aqui — adicionar quando volume justificar).
 */

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string; installmentId: string }>
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id, installmentId } = await ctx.params
  if (!id || !installmentId) {
    return NextResponse.json({ error: 'id e installmentId obrigatorios' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body invalido' }, { status: 400 })
  }

  try {
    // Captura before para audit
    const beforeResult = await updateInstallment(
      installmentId,
      {
        ...(body.amount !== undefined ? { amount: Number(body.amount) } : {}),
        ...(body.method !== undefined ? { method: String(body.method) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.receivedAt !== undefined ? { receivedAt: body.receivedAt } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      { email: auth.user!.email },
    )

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'order.installment.update',
      targetType: 'PaymentInstallment',
      targetId: installmentId,
      summary: `Pedido ${id}: editou parcela ${installmentId}`,
      metadata: {
        orderId: id,
        installmentId,
        after: beforeResult.installment,
        totals: beforeResult.totals,
      },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json(beforeResult)
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id, installmentId } = await ctx.params
  if (!id || !installmentId) {
    return NextResponse.json({ error: 'id e installmentId obrigatorios' }, { status: 400 })
  }

  // Reason eh obrigatorio (CR-2 do post-mortem: mutacoes financeiras
  // tem que ter justificativa rastreavel)
  const url = new URL(request.url)
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
    const result = await softDeleteInstallment(installmentId, { email: auth.user!.email })

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'order.installment.delete',
      targetType: 'PaymentInstallment',
      targetId: installmentId,
      summary: `Pedido ${id}: removeu parcela ${installmentId} (${reason.slice(0, 100)})`,
      metadata: {
        orderId: id,
        installmentId,
        reason: reason.slice(0, 500),
        totals: result.totals,
      },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({ ok: true, totals: result.totals })
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
