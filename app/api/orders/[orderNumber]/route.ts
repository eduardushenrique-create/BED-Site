import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { getOrderByNumber } from '@/lib/database'
import { isAdminRole } from '@/lib/auth-shared'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const { orderNumber } = await context.params
  const order = await getOrderByNumber(orderNumber)

  if (!order) {
    return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 })
  }

  if (order.customerEmail !== auth.user?.email && !isAdminRole(auth.user?.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  return NextResponse.json(order)
}
