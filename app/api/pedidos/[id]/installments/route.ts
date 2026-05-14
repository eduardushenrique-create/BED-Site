import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { DatabaseUnavailableError } from '@/lib/database'
import {
  createInstallment,
  listInstallmentsByOrder,
} from '@/lib/installments'

/**
 * SPEC-005 Fase 2a — endpoints de PaymentInstallment por pedido.
 *
 * - GET  /api/pedidos/[id]/installments        -> lista ativas
 * - POST /api/pedidos/[id]/installments        -> cria nova
 *
 * PATCH e DELETE em /api/pedidos/[id]/installments/[installmentId].
 *
 * Todos exigem requireApiAdmin. Erros de DB indisponivel viram 503 com
 * Retry-After. Validacao server-side (R17 do ADR-003 v2): amount em
 * (0, 100000].
 */

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  }

  try {
    const items = await listInstallmentsByOrder(id)
    return NextResponse.json({ items })
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    throw error
  }
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body invalido' }, { status: 400 })
  }

  try {
    const result = await createInstallment(
      id,
      {
        amount: Number(body.amount),
        method: typeof body.method === 'string' ? body.method : '',
        description: typeof body.description === 'string' ? body.description : null,
        receivedAt: typeof body.receivedAt === 'string' ? body.receivedAt : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        isRefund: Boolean(body.isRefund),
      },
      { email: auth.user!.email },
    )

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'order.installment.create',
      targetType: 'PaymentInstallment',
      targetId: result.installment.id,
      summary: `Pedido ${id}: registrou ${result.installment.isRefund ? 'estorno' : 'pagamento'} de R$ ${result.installment.amount.toFixed(2)} (${result.installment.method})`,
      metadata: {
        orderId: id,
        installmentId: result.installment.id,
        amount: result.installment.amount,
        method: result.installment.method,
        isRefund: result.installment.isRefund,
        totals: result.totals,
      },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    if (error instanceof Error) {
      // Erros de validacao (amount fora de range, method invalido, pedido
      // nao encontrado etc.) viram 400.
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
