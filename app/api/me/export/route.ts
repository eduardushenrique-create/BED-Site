import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import {
  getCustomerByEmail,
  listAddressesByCustomerId,
  listOrdersByCustomerEmail,
  listWishlistForCustomer,
} from '@/lib/database'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  try {
    const customer = await getCustomerByEmail(auth.user!.email)
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const [orders, addresses, wishlist] = await Promise.all([
      listOrdersByCustomerEmail(customer.email, { limit: 50, offset: 0 }),
      listAddressesByCustomerId(customer.id).catch(() => []),
      listWishlistForCustomer(customer.id).catch(() => []),
    ])

    const payload = {
      exportedAt: new Date().toISOString(),
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || null,
        cpf: customer.cpf || null,
        isVerified: customer.isVerified,
        createdAt: customer.createdAt,
      },
      addresses,
      orders: orders.orders,
      wishlist: wishlist.map(w => ({
        productId: w.productId,
        productName: w.product?.name || null,
        productSlug: w.product?.slug || null,
        addedAt: w.createdAt,
      })),
    }

    const filename = `bed-meus-dados-${customer.id}-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    captureException(error, { context: 'api.me.export' })
    return NextResponse.json({ error: 'Erro ao exportar dados.' }, { status: 500 })
  }
}
