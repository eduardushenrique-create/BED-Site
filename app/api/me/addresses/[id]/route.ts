import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { deleteAddress, getCustomerByEmail, updateAddress } from '@/lib/database'
import { validateCEP } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await getCustomerByEmail(auth.user!.email)
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const { id } = await context.params
  const body = await request.json()

  if (body.zipCode !== undefined && !validateCEP(String(body.zipCode))) {
    return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
  }

  const updated = await updateAddress(customer.id, id, {
    label: body.label,
    recipient: body.recipient ? String(body.recipient).trim() : undefined,
    zipCode: body.zipCode !== undefined ? String(body.zipCode).replace(/\D/g, '') : undefined,
    street: body.street ? String(body.street).trim() : undefined,
    number: body.number ? String(body.number).trim() : undefined,
    complement: body.complement !== undefined ? (body.complement ? String(body.complement).trim() : undefined) : undefined,
    neighborhood: body.neighborhood ? String(body.neighborhood).trim() : undefined,
    city: body.city ? String(body.city).trim() : undefined,
    state: body.state ? String(body.state).trim().toUpperCase().slice(0, 2) : undefined,
    country: body.country,
    isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
  })

  if (!updated) {
    return NextResponse.json({ error: 'Endereço não encontrado.' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await getCustomerByEmail(auth.user!.email)
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const { id } = await context.params
  const ok = await deleteAddress(customer.id, id)
  if (!ok) return NextResponse.json({ error: 'Endereço não encontrado.' }, { status: 404 })

  return NextResponse.json({ success: true })
}
