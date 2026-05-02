import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { getOrderByIdOrNumber } from '@/lib/database'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID do pedido é obrigatório.' }, { status: 400 })
    }
    const order = await getOrderByIdOrNumber(id)
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    return NextResponse.json(order)
  } catch (error) {
    captureException(error, { context: 'api.pedidos.[id]', detail: 'GET getOrderByIdOrNumber failed' })
    return NextResponse.json({ error: 'Erro ao buscar pedido.' }, { status: 500 })
  }
}
