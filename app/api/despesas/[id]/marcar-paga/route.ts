import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { markExpensePaid } from '@/lib/expenses'

export const dynamic = 'force-dynamic'

// POST /api/despesas/[id]/marcar-paga
// Body: { paidAt?: string, paymentMethod?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const paidAt =
    typeof body.paidAt === 'string' && body.paidAt
      ? body.paidAt
      : new Date().toISOString()

  const paymentMethod =
    typeof body.paymentMethod === 'string' ? body.paymentMethod : undefined

  const actor = { email: auth.user!.email ?? '', role: auth.user!.role }

  const { expense, error } = await markExpensePaid(id, { paidAt, paymentMethod }, actor)

  if (error) {
    const status = error.includes('não encontrada') ? 404 : 400
    return NextResponse.json({ error }, { status })
  }

  return NextResponse.json({ expense })
}
