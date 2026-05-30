import { NextRequest, NextResponse } from 'next/server'
import { requireApiRole } from '@/lib/api-auth'
import { PRIVILEGED_ROLES } from '@/lib/auth-shared'
import { getCustomerById, listOrdersByCustomerEmail, listAddressesByCustomerId } from '@/lib/database'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // M1 — detalhe de cliente (PII + histórico de pedidos): alta alçada.
  const auth = await requireApiRole(PRIVILEGED_ROLES)
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID do cliente é obrigatório.' }, { status: 400 })
    }

    const customer = await getCustomerById(id)
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const [ordersData, addresses] = await Promise.all([
      listOrdersByCustomerEmail(customer.email, { limit: 50, offset: 0 }),
      listAddressesByCustomerId(customer.id).catch(() => []),
    ])

    const orders = ordersData.orders
    const totalSpent = orders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + (o.total || 0), 0)
    const paidCount = orders.filter(o => o.paymentStatus === 'paid').length

    return NextResponse.json({
      customer,
      orders,
      totalOrders: ordersData.total,
      paidCount,
      totalSpent,
      addresses,
    })
  } catch (error) {
    captureException(error, { context: 'api.clientes.[id]', detail: 'GET failed' })
    return NextResponse.json({ error: 'Erro ao buscar cliente.' }, { status: 500 })
  }
}
