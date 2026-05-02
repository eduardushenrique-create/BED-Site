import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { getCustomerByEmail, removeFromWishlist } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await getCustomerByEmail(auth.user!.email)
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const { productId } = await context.params
  if (!productId) {
    return NextResponse.json({ error: 'productId é obrigatório.' }, { status: 400 })
  }

  const result = await removeFromWishlist(customer.id, productId)
  if (!result.ok) {
    return NextResponse.json({ error: 'Erro ao remover.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
