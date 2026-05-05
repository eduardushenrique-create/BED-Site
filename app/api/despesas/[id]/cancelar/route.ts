import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { cancelExpense } from '@/lib/expenses'

export const dynamic = 'force-dynamic'

// POST /api/despesas/[id]/cancelar
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  const actor = { email: auth.user!.email ?? '', role: auth.user!.role }

  const { expense, error } = await cancelExpense(id, actor)

  if (error) {
    const status = error.includes('não encontrada') ? 404 : 400
    return NextResponse.json({ error }, { status })
  }

  return NextResponse.json({ expense })
}
