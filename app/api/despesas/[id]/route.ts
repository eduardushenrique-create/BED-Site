import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { getExpenseById, updateExpense } from '@/lib/expenses'
import { validateExpenseInput } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// GET /api/despesas/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  const result = await getExpenseById(id)
  if (!result) {
    return NextResponse.json({ error: 'Despesa não encontrada.' }, { status: 404 })
  }

  return NextResponse.json(result)
}

// PUT /api/despesas/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  // For updates, only validate the fields that were provided (partial update)
  const { errors, valid } = validateExpenseInput(body, { requireAllFields: false })
  if (!valid) {
    return NextResponse.json({ error: 'Dados inválidos.', errors }, { status: 400 })
  }

  // archivedAt is not editable via PUT
  const {
    title,
    description,
    amount,
    categoryId,
    type,
    status,
    paymentMethod,
    costCenter,
    competenceDate,
    dueDate,
    paidAt,
    receiptUrl,
    invoiceNumber,
    supplierName,
    relatedFilamentId,
    relatedComponentId,
    relatedPrinterId,
    notes,
    isRecurring,
    recurrenceRule,
    recurrenceParentId,
  } = body

  const { expense, error } = await updateExpense(
    id,
    {
      ...(title !== undefined ? { title: title as string } : {}),
      ...(description !== undefined ? { description: (description as string | null) ?? null } : {}),
      ...(amount !== undefined ? { amount: String(amount) } : {}),
      ...(categoryId !== undefined ? { categoryId: categoryId as string } : {}),
      ...(type !== undefined ? { type: type as string } : {}),
      ...(status !== undefined ? { status: status as string } : {}),
      ...(paymentMethod !== undefined ? { paymentMethod: (paymentMethod as string | null) ?? null } : {}),
      ...(costCenter !== undefined ? { costCenter: costCenter as string } : {}),
      ...(competenceDate !== undefined ? { competenceDate: competenceDate as string } : {}),
      ...(dueDate !== undefined ? { dueDate: (dueDate as string | null) ?? null } : {}),
      ...(paidAt !== undefined ? { paidAt: (paidAt as string | null) ?? null } : {}),
      ...(receiptUrl !== undefined ? { receiptUrl: (receiptUrl as string | null) ?? null } : {}),
      ...(invoiceNumber !== undefined ? { invoiceNumber: (invoiceNumber as string | null) ?? null } : {}),
      ...(supplierName !== undefined ? { supplierName: (supplierName as string | null) ?? null } : {}),
      ...(relatedFilamentId !== undefined ? { relatedFilamentId: (relatedFilamentId as string | null) ?? null } : {}),
      ...(relatedComponentId !== undefined ? { relatedComponentId: (relatedComponentId as string | null) ?? null } : {}),
      ...(relatedPrinterId !== undefined ? { relatedPrinterId: (relatedPrinterId as string | null) ?? null } : {}),
      ...(notes !== undefined ? { notes: (notes as string | null) ?? null } : {}),
      ...(isRecurring !== undefined ? { isRecurring: Boolean(isRecurring) } : {}),
      ...(recurrenceRule !== undefined ? { recurrenceRule: (recurrenceRule as string | null) ?? null } : {}),
      ...(recurrenceParentId !== undefined ? { recurrenceParentId: (recurrenceParentId as string | null) ?? null } : {}),
    },
    { email: auth.user!.email, role: auth.user!.role || null },
  )

  if (!expense) {
    const status404 = error === 'Despesa não encontrada.' ? 404 : 400
    return NextResponse.json({ error: error || 'Erro ao atualizar despesa.' }, { status: status404 })
  }

  return NextResponse.json({ expense })
}
