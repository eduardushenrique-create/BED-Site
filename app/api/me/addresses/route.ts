import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { createAddress, getCustomerByEmail, listAddressesByCustomerId } from '@/lib/database'
import { validateCEP } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await getCustomerByEmail(auth.user!.email)
  if (!customer) return NextResponse.json([])

  const addresses = await listAddressesByCustomerId(customer.id)
  return NextResponse.json(addresses)
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await getCustomerByEmail(auth.user!.email)
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const body = await request.json()
  const error = validateAddressInput(body)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const result = await createAddress(customer.id, {
    label: body.label,
    recipient: String(body.recipient).trim(),
    zipCode: String(body.zipCode).replace(/\D/g, ''),
    street: String(body.street).trim(),
    number: String(body.number).trim(),
    complement: body.complement ? String(body.complement).trim() : undefined,
    neighborhood: String(body.neighborhood).trim(),
    city: String(body.city).trim(),
    state: String(body.state).trim().toUpperCase().slice(0, 2),
    country: 'BR',
    isDefault: Boolean(body.isDefault),
  })

  if (!result.address) {
    return NextResponse.json({ error: result.error || 'Erro ao salvar endereço.' }, { status: 400 })
  }

  return NextResponse.json(result.address, { status: 201 })
}

function validateAddressInput(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Dados inválidos.'
  if (!body.recipient || String(body.recipient).trim().length < 2) return 'Nome do destinatário é obrigatório.'
  if (!validateCEP(String(body.zipCode || ''))) return 'CEP inválido.'
  if (!body.street || !String(body.street).trim()) return 'Rua é obrigatória.'
  if (!body.number || !String(body.number).trim()) return 'Número é obrigatório.'
  if (!body.neighborhood || !String(body.neighborhood).trim()) return 'Bairro é obrigatório.'
  if (!body.city || !String(body.city).trim()) return 'Cidade é obrigatória.'
  if (!body.state || String(body.state).trim().length < 2) return 'Estado é obrigatório.'
  return null
}
