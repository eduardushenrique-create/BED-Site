import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { recordMovement, type StockMovementType } from '@/lib/components-stock'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

const ALLOWED_TYPES: StockMovementType[] = ['in', 'out', 'adjust']

/**
 * Lança um movimento manual. Tipos aceitos via API: 'in' (entrada),
 * 'out' (saída manual fora de produção — perda, descarte etc.),
 * 'adjust' (ajuste de inventário).
 *
 * 'reverse' fica reservado para o fluxo automático da Fase 3 (não é
 * lançável manualmente).
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params

  let body: { type?: string; quantity?: number; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const type = body.type as StockMovementType
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo deve ser in, out ou adjust.' }, { status: 400 })
  }
  const quantity = Number(body.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'Quantidade deve ser positiva.' }, { status: 400 })
  }

  const result = await recordMovement({
    componentId: id,
    type,
    quantity,
    reason: body.reason || null,
    createdByEmail: auth.user!.email,
  })

  if (!result.movement) {
    return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })
  }

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'component.movement',
    targetType: 'Component',
    targetId: id,
    summary: `${type === 'in' ? 'Entrada' : type === 'out' ? 'Saída' : 'Ajuste'} de ${quantity} em estoque`,
    metadata: { type, quantity, balanceAfter: result.movement.balanceAfter },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json({ movement: result.movement, component: result.component })
}
