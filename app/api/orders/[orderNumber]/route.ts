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

  // SPEC-005 §9.3 / R5: pedidos createdVia='admin' nao aparecem para
  // clientes (mesmo se customerEmail bater). Admin acessa via /admin.
  // Retorna 404 (nao 403) pra nao revelar a existencia.
  if (
    (order as { createdVia?: string }).createdVia === 'admin' &&
    !isAdminRole(auth.user?.role)
  ) {
    return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 })
  }

  return NextResponse.json(order)
}
