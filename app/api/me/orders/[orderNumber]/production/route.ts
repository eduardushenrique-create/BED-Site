import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { getCustomerOrderProduction } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  try {
    const { orderNumber } = await context.params
    if (!orderNumber) {
      return NextResponse.json({ error: 'Número do pedido é obrigatório.' }, { status: 400 })
    }

    const result = await getCustomerOrderProduction(
      { email: auth.user!.email },
      orderNumber
    )
    if (result === null) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/me/orders/[orderNumber]/production] GET failed:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar produção do pedido.' },
      { status: 500 }
    )
  }
}
