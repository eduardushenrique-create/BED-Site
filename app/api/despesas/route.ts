import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { getClientIp } from '@/lib/rate-limit'
import { listExpenses, createExpense } from '@/lib/expenses'
import { validateExpenseInput } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// GET /api/despesas
// Query: q, status, categoryId, type, costCenter, startDate, endDate, includeArchived, page, limit
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)

  const result = await listExpenses({
    q: searchParams.get('q') || undefined,
    status: searchParams.get('status') || undefined,
    categoryId: searchParams.get('categoryId') || undefined,
    type: searchParams.get('type') || undefined,
    costCenter: searchParams.get('costCenter') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    includeArchived: searchParams.get('includeArchived') === '1' || searchParams.get('includeArchived') === 'true',
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
  })

  return NextResponse.json(result)
}

// POST /api/despesas
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { errors, valid } = validateExpenseInput(body, { requireAllFields: true })
  if (!valid) {
    return NextResponse.json({ error: 'Dados inválidos.', errors }, { status: 400 })
  }

  const { expense, error } = await createExpense(
    {
      title: body.title as string,
      description: (body.description as string | null | undefined) ?? null,
      amount: String(body.amount),
      categoryId: body.categoryId as string,
      type: body.type as string,
      status: body.status as string,
      paymentMethod: (body.paymentMethod as string | null | undefined) ?? null,
      costCenter: (body.costCenter as string) || 'other',
      competenceDate: body.competenceDate as string,
      dueDate: (body.dueDate as string | null | undefined) ?? null,
      paidAt: (body.paidAt as string | null | undefined) ?? null,
      receiptUrl: (body.receiptUrl as string | null | undefined) ?? null,
      invoiceNumber: (body.invoiceNumber as string | null | undefined) ?? null,
      supplierName: (body.supplierName as string | null | undefined) ?? null,
      relatedFilamentId: (body.relatedFilamentId as string | null | undefined) ?? null,
      relatedComponentId: (body.relatedComponentId as string | null | undefined) ?? null,
      relatedPrinterId: (body.relatedPrinterId as string | null | undefined) ?? null,
      notes: (body.notes as string | null | undefined) ?? null,
      isRecurring: typeof body.isRecurring === 'boolean' ? body.isRecurring : false,
      recurrenceRule: (body.recurrenceRule as string | null | undefined) ?? null,
      recurrenceParentId: (body.recurrenceParentId as string | null | undefined) ?? null,
    },
    { email: auth.user!.email, role: auth.user!.role || null },
  )

  if (!expense) {
    return NextResponse.json({ error: error || 'Erro ao criar despesa.' }, { status: 400 })
  }

  void getClientIp(request) // available if needed for future rate limit
  return NextResponse.json({ expense }, { status: 201 })
}
