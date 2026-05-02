import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { anonymizeCustomer, getCustomerByEmail, updateCustomer } from '@/lib/database'
import { clearSession } from '@/lib/auth'
import { validateCPF } from '@/lib/validation'
import { captureException } from '@/lib/observability'
import { recordAuditEntry } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const customer = await getCustomerByEmail(auth.user!.email)
  if (!customer) {
    return NextResponse.json({
      id: auth.user!.id,
      name: auth.user!.name,
      email: auth.user!.email,
      phone: null,
      cpf: null,
    })
  }

  return NextResponse.json({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone || null,
    cpf: customer.cpf || null,
    createdAt: customer.createdAt,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const body = await request.json()
  const { name, phone, cpf } = body || {}

  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
    return NextResponse.json({ error: 'Nome deve ter ao menos 2 caracteres.' }, { status: 400 })
  }
  if (phone !== undefined && phone !== null && phone !== '') {
    const digits = String(phone).replace(/\D/g, '')
    if (!/^\d{10,11}$/.test(digits)) {
      return NextResponse.json({ error: 'Telefone inválido.' }, { status: 400 })
    }
  }
  if (cpf !== undefined && cpf !== null && cpf !== '' && !validateCPF(String(cpf))) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
  }

  const customer = await getCustomerByEmail(auth.user!.email)
  if (!customer) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  const updated = await updateCustomer(customer.id, {
    name: name !== undefined ? String(name).trim() : undefined,
    phone: phone !== undefined ? String(phone).replace(/\D/g, '') || undefined : undefined,
    cpf: cpf !== undefined ? String(cpf).replace(/\D/g, '') || undefined : undefined,
  })

  if (!updated) {
    return NextResponse.json({ error: 'Não foi possível atualizar.' }, { status: 500 })
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone || null,
    cpf: updated.cpf || null,
  })
}

export async function DELETE() {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  // Admins can't self-delete via this endpoint — they should use dedicated tooling.
  if (auth.user!.role !== 'customer') {
    return NextResponse.json(
      { error: 'Contas administrativas não podem ser excluídas por este endpoint.' },
      { status: 403 },
    )
  }

  try {
    const customer = await getCustomerByEmail(auth.user!.email)
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const result = await anonymizeCustomer(customer.id, customer.email)
    if (!result.ok) {
      return NextResponse.json({ error: 'Não foi possível excluir a conta.' }, { status: 500 })
    }

    recordAuditEntry({
      actorEmail: customer.email,
      actorRole: 'customer',
      action: 'customer.delete',
      targetType: 'Customer',
      targetId: customer.id,
      summary: `Cliente solicitou exclusão da conta (anonimização)`,
      metadata: { customerId: customer.id },
    }).catch(() => {})

    await clearSession()
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.me.DELETE' })
    return NextResponse.json({ error: 'Erro ao excluir conta.' }, { status: 500 })
  }
}
