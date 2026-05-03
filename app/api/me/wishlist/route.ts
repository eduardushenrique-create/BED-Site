import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { addToWishlist, createCustomer, getCustomerByEmail, listWishlistForCustomer } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * Garante que o usuário logado tenha um Customer associado (admin não
 * tem Customer row por padrão — ele vive em AdminUser). Sem isso, admin
 * clica em favoritar e bate em 404.
 */
async function ensureCustomer(email: string, name: string) {
  const existing = await getCustomerByEmail(email)
  if (existing) return existing
  return await createCustomer({ name, email, phone: undefined })
}

export async function GET() {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await ensureCustomer(auth.user!.email, auth.user!.name)
  if (!customer) return NextResponse.json([])

  const items = await listWishlistForCustomer(customer.id)
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await ensureCustomer(auth.user!.email, auth.user!.name)
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const productId = body && typeof body.productId === 'string' ? body.productId.trim() : ''
  if (!productId) {
    return NextResponse.json({ error: 'productId é obrigatório.' }, { status: 400 })
  }

  const result = await addToWishlist(customer.id, productId)
  if (!result.ok) {
    const status = result.error === 'product_not_found' ? 404 : 400
    return NextResponse.json({ error: result.error || 'Erro ao adicionar.' }, { status })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
