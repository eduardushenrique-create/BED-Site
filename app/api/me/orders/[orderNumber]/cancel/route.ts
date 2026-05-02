import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { cancelOrderByOwner } from '@/lib/database'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

const ERRORS: Record<string, { message: string; status: number }> = {
  not_found: { message: 'Pedido não encontrado.', status: 404 },
  not_owner: { message: 'Pedido não pertence ao cliente logado.', status: 403 },
  not_cancellable: {
    message: 'Este pedido não pode mais ser cancelado pelo cliente. Entre em contato com o suporte.',
    status: 409,
  },
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  try {
    const { orderNumber } = await context.params
    if (!orderNumber) {
      return NextResponse.json({ error: 'Número do pedido é obrigatório.' }, { status: 400 })
    }

    const result = await cancelOrderByOwner(orderNumber, auth.user!.email)
    if (!result.ok) {
      const mapped = ERRORS[result.error || 'not_cancellable']
      return NextResponse.json({ error: mapped.message }, { status: mapped.status })
    }

    return NextResponse.json({ ok: true, orderStatus: result.orderStatus })
  } catch (error) {
    captureException(error, { context: 'api.me.orders.[orderNumber].cancel' })
    return NextResponse.json({ error: 'Erro ao cancelar pedido.' }, { status: 500 })
  }
}
