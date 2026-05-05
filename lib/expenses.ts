import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB } from '@/lib/localDb'
import { recordAuditEntry } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpenseStatus = 'pending' | 'paid' | 'canceled' | 'overdue'

export type SerializedExpense = {
  id: string
  title: string
  description: string | null
  /** Always a string — never a JS number — to avoid Decimal precision loss. */
  amount: string
  categoryId: string
  categoryName?: string | null
  type: string
  /** Runtime-derived. Never stored as 'overdue' in DB. */
  status: ExpenseStatus
  paymentMethod: string | null
  costCenter: string
  competenceDate: string
  dueDate: string | null
  paidAt: string | null
  receiptUrl: string | null
  invoiceNumber: string | null
  supplierName: string | null
  relatedFilamentId: string | null
  relatedFilamentName?: string | null
  relatedComponentId: string | null
  relatedComponentName?: string | null
  relatedPrinterId: string | null
  relatedPrinterName?: string | null
  notes: string | null
  createdByEmail: string | null
  updatedByEmail: string | null
  archivedAt: string | null
  isRecurring: boolean
  recurrenceRule: string | null
  recurrenceParentId: string | null
  createdAt: string
  updatedAt: string
}

export type SerializedExpenseCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  defaultType: string | null
  costCenter: string | null
  color: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ExpenseActor = {
  email: string
  role?: string | null
}

export type CreateExpenseInput = {
  title: string
  description?: string | null
  amount: string
  categoryId: string
  type: string
  status: string
  paymentMethod?: string | null
  costCenter?: string
  competenceDate: string
  dueDate?: string | null
  paidAt?: string | null
  receiptUrl?: string | null
  invoiceNumber?: string | null
  supplierName?: string | null
  relatedFilamentId?: string | null
  relatedComponentId?: string | null
  relatedPrinterId?: string | null
  notes?: string | null
  isRecurring?: boolean
  recurrenceRule?: string | null
  recurrenceParentId?: string | null
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>

export type ListExpensesFilters = {
  q?: string
  status?: string
  categoryId?: string
  type?: string
  costCenter?: string
  startDate?: string
  endDate?: string
  includeArchived?: boolean
  page?: number
  limit?: number
}

export type ListExpensesResult = {
  expenses: SerializedExpense[]
  total: number
  page: number
  limit: number
  summary: {
    totalPaid: string
    totalPending: string
    totalOverdue: string
    totalCanceled: string
  }
}

export type CreateCategoryInput = {
  name: string
  slug: string
  description?: string | null
  defaultType?: string | null
  costCenter?: string | null
  color?: string | null
  isActive?: boolean
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>

// ---------------------------------------------------------------------------
// Helper: derive status at runtime (never persist 'overdue' to DB)
// ---------------------------------------------------------------------------

export function deriveStatus(
  expense: { status: string; dueDate?: Date | string | null },
  now = new Date(),
): ExpenseStatus {
  if (expense.status === 'paid' || expense.status === 'canceled') {
    return expense.status as ExpenseStatus
  }
  if (expense.dueDate && new Date(expense.dueDate) < now) return 'overdue'
  return 'pending'
}

// ---------------------------------------------------------------------------
// ID generator for localDb fallback
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

function serializeExpenseRow(row: {
  id: string
  title: string
  description?: string | null
  amount: { toString(): string }
  categoryId: string
  category?: { name: string } | null
  type: string
  status: string
  paymentMethod?: string | null
  costCenter: string
  competenceDate: Date | string
  dueDate?: Date | string | null
  paidAt?: Date | string | null
  receiptUrl?: string | null
  invoiceNumber?: string | null
  supplierName?: string | null
  relatedFilamentId?: string | null
  relatedFilament?: { name: string } | null
  relatedComponentId?: string | null
  relatedComponent?: { name: string } | null
  relatedPrinterId?: string | null
  relatedPrinter?: { name: string } | null
  notes?: string | null
  createdByEmail?: string | null
  updatedByEmail?: string | null
  archivedAt?: Date | string | null
  isRecurring: boolean
  recurrenceRule?: string | null
  recurrenceParentId?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}): SerializedExpense {
  const toIso = (d: Date | string | null | undefined): string | null =>
    d == null ? null : d instanceof Date ? d.toISOString() : d

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    amount: row.amount.toString(),
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    type: row.type,
    status: deriveStatus({ status: row.status, dueDate: row.dueDate }),
    paymentMethod: row.paymentMethod ?? null,
    costCenter: row.costCenter,
    competenceDate: toIso(row.competenceDate)!,
    dueDate: toIso(row.dueDate),
    paidAt: toIso(row.paidAt),
    receiptUrl: row.receiptUrl ?? null,
    invoiceNumber: row.invoiceNumber ?? null,
    supplierName: row.supplierName ?? null,
    relatedFilamentId: row.relatedFilamentId ?? null,
    relatedFilamentName: row.relatedFilament?.name ?? null,
    relatedComponentId: row.relatedComponentId ?? null,
    relatedComponentName: row.relatedComponent?.name ?? null,
    relatedPrinterId: row.relatedPrinterId ?? null,
    relatedPrinterName: row.relatedPrinter?.name ?? null,
    notes: row.notes ?? null,
    createdByEmail: row.createdByEmail ?? null,
    updatedByEmail: row.updatedByEmail ?? null,
    archivedAt: toIso(row.archivedAt),
    isRecurring: row.isRecurring,
    recurrenceRule: row.recurrenceRule ?? null,
    recurrenceParentId: row.recurrenceParentId ?? null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
  }
}

function serializeCategoryRow(row: {
  id: string
  name: string
  slug: string
  description?: string | null
  defaultType?: string | null
  costCenter?: string | null
  color?: string | null
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
}): SerializedExpenseCategory {
  const toIso = (d: Date | string): string => d instanceof Date ? d.toISOString() : d
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    defaultType: row.defaultType ?? null,
    costCenter: row.costCenter ?? null,
    color: row.color ?? null,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

// ---------------------------------------------------------------------------
// Prisma include helper
// ---------------------------------------------------------------------------

const EXPENSE_INCLUDE = {
  category: { select: { name: true } },
  relatedFilament: { select: { name: true } },
  relatedComponent: { select: { name: true } },
  relatedPrinter: { select: { name: true } },
} as const

// ---------------------------------------------------------------------------
// createExpense
// ---------------------------------------------------------------------------

export async function createExpense(
  input: CreateExpenseInput,
  actor: ExpenseActor,
): Promise<{ expense?: SerializedExpense; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    // localDb fallback
    try {
      const db = readDB()
      const id = generateId('exp')
      const record = {
        id,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        amount: input.amount,
        categoryId: input.categoryId,
        type: input.type,
        status: input.status,
        paymentMethod: input.paymentMethod ?? null,
        costCenter: input.costCenter ?? 'other',
        competenceDate: input.competenceDate,
        dueDate: input.dueDate ?? null,
        paidAt: input.paidAt ?? null,
        receiptUrl: input.receiptUrl ?? null,
        invoiceNumber: input.invoiceNumber ?? null,
        supplierName: input.supplierName ?? null,
        relatedFilamentId: input.relatedFilamentId ?? null,
        relatedComponentId: input.relatedComponentId ?? null,
        relatedPrinterId: input.relatedPrinterId ?? null,
        notes: input.notes?.trim() ?? null,
        createdByEmail: actor.email,
        updatedByEmail: actor.email,
        archivedAt: null,
        isRecurring: input.isRecurring ?? false,
        recurrenceRule: input.recurrenceRule ?? null,
        recurrenceParentId: input.recurrenceParentId ?? null,
        createdAt: now,
        updatedAt: now,
      }
      db.expenses = db.expenses || []
      db.expenses.push(record)
      writeDB(db)

      const cat = db.expenseCategories?.find(c => c.id === record.categoryId)
      const expense = serializeExpenseRow({ ...record, category: cat ? { name: cat.name } : null })
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense.create',
        targetType: 'CompanyExpense',
        targetId: id,
        summary: `Despesa "${record.title}" criada — R$ ${record.amount}`,
        metadata: { amount: record.amount, categoryId: record.categoryId, type: record.type },
      }).catch(() => {})
      return { expense }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'createExpense localDb failed' })
      return { error: 'Erro ao criar despesa.' }
    }
  }

  try {
    const row = await (prisma as any).companyExpense.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        amount: input.amount,
        categoryId: input.categoryId,
        type: input.type,
        status: input.status,
        paymentMethod: input.paymentMethod || null,
        costCenter: input.costCenter ?? 'other',
        competenceDate: new Date(input.competenceDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        paidAt: input.paidAt ? new Date(input.paidAt) : null,
        receiptUrl: input.receiptUrl || null,
        invoiceNumber: input.invoiceNumber || null,
        supplierName: input.supplierName || null,
        relatedFilamentId: input.relatedFilamentId || null,
        relatedComponentId: input.relatedComponentId || null,
        relatedPrinterId: input.relatedPrinterId || null,
        notes: input.notes?.trim() || null,
        createdByEmail: actor.email,
        updatedByEmail: actor.email,
        isRecurring: input.isRecurring ?? false,
        recurrenceRule: input.recurrenceRule || null,
        recurrenceParentId: input.recurrenceParentId || null,
      },
      include: EXPENSE_INCLUDE,
    })

    const expense = serializeExpenseRow(row)
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense.create',
      targetType: 'CompanyExpense',
      targetId: row.id,
      summary: `Despesa "${row.title}" criada — R$ ${row.amount.toString()}`,
      metadata: { amount: row.amount.toString(), categoryId: row.categoryId, type: row.type },
    }).catch(() => {})
    return { expense }
  } catch (err) {
    captureException(err, { context: 'expenses', detail: 'createExpense Prisma failed' })
    return { error: 'Erro ao criar despesa.' }
  }
}

// ---------------------------------------------------------------------------
// listExpenses
// ---------------------------------------------------------------------------

export async function listExpenses(filters: ListExpensesFilters = {}): Promise<ListExpensesResult> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 200)
  const skip = (page - 1) * limit

  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    // localDb fallback
    const db = readDB()
    let items = (db.expenses || []).map(e => {
      const cat = db.expenseCategories?.find(c => c.id === e.categoryId)
      return serializeExpenseRow({ ...e, category: cat ? { name: cat.name } : null })
    })

    if (!filters.includeArchived) {
      items = items.filter(e => e.archivedAt == null)
    }
    if (filters.q) {
      const q = filters.q.toLowerCase()
      items = items.filter(
        e =>
          e.title.toLowerCase().includes(q) ||
          (e.supplierName?.toLowerCase().includes(q)) ||
          (e.invoiceNumber?.toLowerCase().includes(q)),
      )
    }
    if (filters.categoryId) items = items.filter(e => e.categoryId === filters.categoryId)
    if (filters.type) items = items.filter(e => e.type === filters.type)
    if (filters.costCenter) items = items.filter(e => e.costCenter === filters.costCenter)
    if (filters.startDate) items = items.filter(e => e.competenceDate >= filters.startDate!)
    if (filters.endDate) items = items.filter(e => e.competenceDate <= filters.endDate!)
    if (filters.status) {
      items = items.filter(e => e.status === filters.status)
    }

    const total = items.length
    const paged = items.slice(skip, skip + limit)
    const summary = buildSummary(items)
    return { expenses: paged, total, page, limit, summary }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (!filters.includeArchived) {
      where.archivedAt = null
    }
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { supplierName: { contains: filters.q, mode: 'insensitive' } },
        { invoiceNumber: { contains: filters.q, mode: 'insensitive' } },
      ]
    }
    if (filters.categoryId) where.categoryId = filters.categoryId
    if (filters.type) where.type = filters.type
    if (filters.costCenter) where.costCenter = filters.costCenter
    if (filters.startDate || filters.endDate) {
      where.competenceDate = {}
      if (filters.startDate) where.competenceDate.gte = new Date(filters.startDate)
      if (filters.endDate) where.competenceDate.lte = new Date(filters.endDate)
    }

    // 'overdue' is a runtime concept; map it to pending + dueDate < now
    if (filters.status === 'overdue') {
      where.status = 'pending'
      where.dueDate = { lt: new Date() }
    } else if (filters.status && filters.status !== 'overdue') {
      where.status = filters.status
    }

    const [rows, total] = await Promise.all([
      (prisma as any).companyExpense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      (prisma as any).companyExpense.count({ where }),
    ])

    // For summary we run a separate count without pagination but with same filters
    const allForSummary = await (prisma as any).companyExpense.findMany({
      where,
      select: { status: true, dueDate: true, amount: true },
    })

    const expenses = rows.map(serializeExpenseRow)
    const summary = buildSummary(
      allForSummary.map((r: { status: string; dueDate: Date | null; amount: { toString(): string } }) => ({
        status: deriveStatus(r),
        amount: r.amount.toString(),
      })),
    )

    return { expenses, total, page, limit, summary }
  } catch (err) {
    captureException(err, { context: 'expenses', detail: 'listExpenses Prisma failed' })
    return { expenses: [], total: 0, page, limit, summary: buildSummary([]) }
  }
}

function buildSummary(items: { status: string; amount: string }[]): ListExpensesResult['summary'] {
  let totalPaid = 0
  let totalPending = 0
  let totalOverdue = 0
  let totalCanceled = 0

  for (const item of items) {
    const v = parseFloat(item.amount) || 0
    if (item.status === 'paid') totalPaid += v
    else if (item.status === 'canceled') totalCanceled += v
    else if (item.status === 'overdue') totalOverdue += v
    else totalPending += v
  }

  return {
    totalPaid: totalPaid.toFixed(2),
    totalPending: totalPending.toFixed(2),
    totalOverdue: totalOverdue.toFixed(2),
    totalCanceled: totalCanceled.toFixed(2),
  }
}

// ---------------------------------------------------------------------------
// getExpenseById
// ---------------------------------------------------------------------------

export async function getExpenseById(
  id: string,
): Promise<{ expense: SerializedExpense; audits: unknown[] } | null> {
  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    const db = readDB()
    const record = (db.expenses || []).find(e => e.id === id)
    if (!record) return null
    const cat = db.expenseCategories?.find(c => c.id === record.categoryId)
    const expense = serializeExpenseRow({ ...record, category: cat ? { name: cat.name } : null })
    const audits = (db.auditLogs || [])
      .filter(a => a.targetType === 'CompanyExpense' && a.targetId === id)
      .slice(0, 50)
    return { expense, audits }
  }

  try {
    const row = await (prisma as any).companyExpense.findUnique({
      where: { id },
      include: EXPENSE_INCLUDE,
    })
    if (!row) return null

    const expense = serializeExpenseRow(row)
    const audits = await (prisma as any).auditLog.findMany({
      where: { targetType: 'CompanyExpense', targetId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { expense, audits }
  } catch (err) {
    captureException(err, { context: 'expenses', detail: 'getExpenseById Prisma failed' })
    return null
  }
}

// ---------------------------------------------------------------------------
// updateExpense
// ---------------------------------------------------------------------------

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
  actor: ExpenseActor,
): Promise<{ expense?: SerializedExpense; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    try {
      const db = readDB()
      const idx = (db.expenses || []).findIndex(e => e.id === id)
      if (idx === -1) return { error: 'Despesa não encontrada.' }
      const before = { ...db.expenses[idx] }
      const updated = {
        ...before,
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod ?? null } : {}),
        ...(input.costCenter !== undefined ? { costCenter: input.costCenter } : {}),
        ...(input.competenceDate !== undefined ? { competenceDate: input.competenceDate } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ?? null } : {}),
        ...(input.paidAt !== undefined ? { paidAt: input.paidAt ?? null } : {}),
        ...(input.receiptUrl !== undefined ? { receiptUrl: input.receiptUrl ?? null } : {}),
        ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber ?? null } : {}),
        ...(input.supplierName !== undefined ? { supplierName: input.supplierName ?? null } : {}),
        ...(input.relatedFilamentId !== undefined ? { relatedFilamentId: input.relatedFilamentId ?? null } : {}),
        ...(input.relatedComponentId !== undefined ? { relatedComponentId: input.relatedComponentId ?? null } : {}),
        ...(input.relatedPrinterId !== undefined ? { relatedPrinterId: input.relatedPrinterId ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() ?? null } : {}),
        ...(input.isRecurring !== undefined ? { isRecurring: input.isRecurring } : {}),
        ...(input.recurrenceRule !== undefined ? { recurrenceRule: input.recurrenceRule ?? null } : {}),
        ...(input.recurrenceParentId !== undefined ? { recurrenceParentId: input.recurrenceParentId ?? null } : {}),
        updatedByEmail: actor.email,
        updatedAt: now,
      }
      db.expenses[idx] = updated
      writeDB(db)
      const cat = db.expenseCategories?.find(c => c.id === updated.categoryId)
      const expense = serializeExpenseRow({ ...updated, category: cat ? { name: cat.name } : null })
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense.update',
        targetType: 'CompanyExpense',
        targetId: id,
        summary: `Despesa "${updated.title}" atualizada`,
        metadata: { before, after: updated },
      }).catch(() => {})
      return { expense }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'updateExpense localDb failed' })
      return { error: 'Erro ao atualizar despesa.' }
    }
  }

  try {
    const before = await (prisma as any).companyExpense.findUnique({ where: { id } })
    if (!before) return { error: 'Despesa não encontrada.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { updatedByEmail: actor.email }
    if (input.title !== undefined) data.title = input.title.trim()
    if (input.description !== undefined) data.description = input.description?.trim() || null
    if (input.amount !== undefined) data.amount = input.amount
    if (input.categoryId !== undefined) data.categoryId = input.categoryId
    if (input.type !== undefined) data.type = input.type
    if (input.status !== undefined) data.status = input.status
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod || null
    if (input.costCenter !== undefined) data.costCenter = input.costCenter
    if (input.competenceDate !== undefined) data.competenceDate = new Date(input.competenceDate)
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null
    if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null
    if (input.receiptUrl !== undefined) data.receiptUrl = input.receiptUrl || null
    if (input.invoiceNumber !== undefined) data.invoiceNumber = input.invoiceNumber || null
    if (input.supplierName !== undefined) data.supplierName = input.supplierName || null
    if (input.relatedFilamentId !== undefined) data.relatedFilamentId = input.relatedFilamentId || null
    if (input.relatedComponentId !== undefined) data.relatedComponentId = input.relatedComponentId || null
    if (input.relatedPrinterId !== undefined) data.relatedPrinterId = input.relatedPrinterId || null
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null
    if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring
    if (input.recurrenceRule !== undefined) data.recurrenceRule = input.recurrenceRule || null
    if (input.recurrenceParentId !== undefined) data.recurrenceParentId = input.recurrenceParentId || null

    const row = await (prisma as any).companyExpense.update({
      where: { id },
      data,
      include: EXPENSE_INCLUDE,
    })
    const expense = serializeExpenseRow(row)
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense.update',
      targetType: 'CompanyExpense',
      targetId: id,
      summary: `Despesa "${row.title}" atualizada`,
      metadata: {
        before: {
          title: before.title,
          amount: before.amount?.toString(),
          status: before.status,
        },
        after: {
          title: row.title,
          amount: row.amount?.toString(),
          status: row.status,
        },
      },
    }).catch(() => {})
    return { expense }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { error: 'Despesa não encontrada.' }
    captureException(err, { context: 'expenses', detail: 'updateExpense Prisma failed' })
    return { error: 'Erro ao atualizar despesa.' }
  }
}

// ---------------------------------------------------------------------------
// markExpensePaid
// ---------------------------------------------------------------------------

export async function markExpensePaid(
  id: string,
  opts: { paidAt: string; paymentMethod?: string | null },
  actor: ExpenseActor,
): Promise<{ expense?: SerializedExpense; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    try {
      const db = readDB()
      const idx = (db.expenses || []).findIndex(e => e.id === id)
      if (idx === -1) return { error: 'Despesa não encontrada.' }
      const current = db.expenses[idx]
      if (current.status === 'paid') return { error: 'Despesa já está paga.' }
      if (current.status === 'canceled') return { error: 'Despesa cancelada não pode ser marcada como paga.' }
      const updated = {
        ...current,
        status: 'paid',
        paidAt: opts.paidAt,
        paymentMethod: opts.paymentMethod ?? current.paymentMethod,
        updatedByEmail: actor.email,
        updatedAt: now,
      }
      db.expenses[idx] = updated
      writeDB(db)
      const cat = db.expenseCategories?.find(c => c.id === updated.categoryId)
      const expense = serializeExpenseRow({ ...updated, category: cat ? { name: cat.name } : null })
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense.mark_paid',
        targetType: 'CompanyExpense',
        targetId: id,
        summary: `Despesa "${updated.title}" marcada como paga`,
        metadata: { paidAt: opts.paidAt, paymentMethod: opts.paymentMethod },
      }).catch(() => {})
      return { expense }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'markExpensePaid localDb failed' })
      return { error: 'Erro ao marcar despesa como paga.' }
    }
  }

  try {
    const current = await (prisma as any).companyExpense.findUnique({ where: { id } })
    if (!current) return { error: 'Despesa não encontrada.' }
    if (current.status === 'paid') return { error: 'Despesa já está paga.' }
    if (current.status === 'canceled') return { error: 'Despesa cancelada não pode ser marcada como paga.' }

    const row = await (prisma as any).companyExpense.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(opts.paidAt),
        ...(opts.paymentMethod !== undefined ? { paymentMethod: opts.paymentMethod || null } : {}),
        updatedByEmail: actor.email,
      },
      include: EXPENSE_INCLUDE,
    })
    const expense = serializeExpenseRow(row)
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense.mark_paid',
      targetType: 'CompanyExpense',
      targetId: id,
      summary: `Despesa "${row.title}" marcada como paga`,
      metadata: { paidAt: opts.paidAt, paymentMethod: opts.paymentMethod },
    }).catch(() => {})
    return { expense }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { error: 'Despesa não encontrada.' }
    captureException(err, { context: 'expenses', detail: 'markExpensePaid Prisma failed' })
    return { error: 'Erro ao marcar despesa como paga.' }
  }
}

// ---------------------------------------------------------------------------
// cancelExpense
// ---------------------------------------------------------------------------

export async function cancelExpense(
  id: string,
  actor: ExpenseActor,
): Promise<{ expense?: SerializedExpense; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    try {
      const db = readDB()
      const idx = (db.expenses || []).findIndex(e => e.id === id)
      if (idx === -1) return { error: 'Despesa não encontrada.' }
      const current = db.expenses[idx]
      if (current.status === 'canceled') return { error: 'Despesa já está cancelada.' }
      const updated = {
        ...current,
        status: 'canceled',
        updatedByEmail: actor.email,
        updatedAt: now,
      }
      db.expenses[idx] = updated
      writeDB(db)
      const cat = db.expenseCategories?.find(c => c.id === updated.categoryId)
      const expense = serializeExpenseRow({ ...updated, category: cat ? { name: cat.name } : null })
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense.cancel',
        targetType: 'CompanyExpense',
        targetId: id,
        summary: `Despesa "${updated.title}" cancelada`,
      }).catch(() => {})
      return { expense }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'cancelExpense localDb failed' })
      return { error: 'Erro ao cancelar despesa.' }
    }
  }

  try {
    const current = await (prisma as any).companyExpense.findUnique({ where: { id } })
    if (!current) return { error: 'Despesa não encontrada.' }
    if (current.status === 'canceled') return { error: 'Despesa já está cancelada.' }

    const row = await (prisma as any).companyExpense.update({
      where: { id },
      data: { status: 'canceled', updatedByEmail: actor.email },
      include: EXPENSE_INCLUDE,
    })
    const expense = serializeExpenseRow(row)
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense.cancel',
      targetType: 'CompanyExpense',
      targetId: id,
      summary: `Despesa "${row.title}" cancelada`,
    }).catch(() => {})
    return { expense }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { error: 'Despesa não encontrada.' }
    captureException(err, { context: 'expenses', detail: 'cancelExpense Prisma failed' })
    return { error: 'Erro ao cancelar despesa.' }
  }
}

// ---------------------------------------------------------------------------
// archiveExpense
// ---------------------------------------------------------------------------

export async function archiveExpense(
  id: string,
  actor: ExpenseActor,
): Promise<{ expense?: SerializedExpense; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    try {
      const db = readDB()
      const idx = (db.expenses || []).findIndex(e => e.id === id)
      if (idx === -1) return { error: 'Despesa não encontrada.' }
      if (db.expenses[idx].archivedAt) return { error: 'Despesa já está arquivada.' }
      const updated = {
        ...db.expenses[idx],
        archivedAt: now,
        updatedByEmail: actor.email,
        updatedAt: now,
      }
      db.expenses[idx] = updated
      writeDB(db)
      const cat = db.expenseCategories?.find(c => c.id === updated.categoryId)
      const expense = serializeExpenseRow({ ...updated, category: cat ? { name: cat.name } : null })
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense.archive',
        targetType: 'CompanyExpense',
        targetId: id,
        summary: `Despesa "${updated.title}" arquivada`,
      }).catch(() => {})
      return { expense }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'archiveExpense localDb failed' })
      return { error: 'Erro ao arquivar despesa.' }
    }
  }

  try {
    const current = await (prisma as any).companyExpense.findUnique({ where: { id } })
    if (!current) return { error: 'Despesa não encontrada.' }
    if (current.archivedAt) return { error: 'Despesa já está arquivada.' }

    const row = await (prisma as any).companyExpense.update({
      where: { id },
      data: { archivedAt: new Date(), updatedByEmail: actor.email },
      include: EXPENSE_INCLUDE,
    })
    const expense = serializeExpenseRow(row)
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense.archive',
      targetType: 'CompanyExpense',
      targetId: id,
      summary: `Despesa "${row.title}" arquivada`,
    }).catch(() => {})
    return { expense }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { error: 'Despesa não encontrada.' }
    captureException(err, { context: 'expenses', detail: 'archiveExpense Prisma failed' })
    return { error: 'Erro ao arquivar despesa.' }
  }
}

// ---------------------------------------------------------------------------
// restoreExpense
// ---------------------------------------------------------------------------

export async function restoreExpense(
  id: string,
  actor: ExpenseActor,
): Promise<{ expense?: SerializedExpense; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    try {
      const db = readDB()
      const idx = (db.expenses || []).findIndex(e => e.id === id)
      if (idx === -1) return { error: 'Despesa não encontrada.' }
      if (!db.expenses[idx].archivedAt) return { error: 'Despesa não está arquivada.' }
      const updated = {
        ...db.expenses[idx],
        archivedAt: null,
        updatedByEmail: actor.email,
        updatedAt: now,
      }
      db.expenses[idx] = updated
      writeDB(db)
      const cat = db.expenseCategories?.find(c => c.id === updated.categoryId)
      const expense = serializeExpenseRow({ ...updated, category: cat ? { name: cat.name } : null })
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense.restore',
        targetType: 'CompanyExpense',
        targetId: id,
        summary: `Despesa "${updated.title}" restaurada`,
      }).catch(() => {})
      return { expense }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'restoreExpense localDb failed' })
      return { error: 'Erro ao restaurar despesa.' }
    }
  }

  try {
    const current = await (prisma as any).companyExpense.findUnique({ where: { id } })
    if (!current) return { error: 'Despesa não encontrada.' }
    if (!current.archivedAt) return { error: 'Despesa não está arquivada.' }

    const row = await (prisma as any).companyExpense.update({
      where: { id },
      data: { archivedAt: null, updatedByEmail: actor.email },
      include: EXPENSE_INCLUDE,
    })
    const expense = serializeExpenseRow(row)
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense.restore',
      targetType: 'CompanyExpense',
      targetId: id,
      summary: `Despesa "${row.title}" restaurada`,
    }).catch(() => {})
    return { expense }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { error: 'Despesa não encontrada.' }
    captureException(err, { context: 'expenses', detail: 'restoreExpense Prisma failed' })
    return { error: 'Erro ao restaurar despesa.' }
  }
}

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

export async function listCategories(
  includeInactive = false,
): Promise<SerializedExpenseCategory[]> {
  if (!hasDatabase || !(prisma as any)?.expenseCategory) {
    const db = readDB()
    let cats = db.expenseCategories || []
    if (!includeInactive) cats = cats.filter(c => c.isActive)
    return cats.map(serializeCategoryRow)
  }

  try {
    const where = includeInactive ? {} : { isActive: true }
    const rows = await (prisma as any).expenseCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    return rows.map(serializeCategoryRow)
  } catch (err) {
    captureException(err, { context: 'expenses', detail: 'listCategories Prisma failed' })
    return []
  }
}

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

export async function createCategory(
  input: CreateCategoryInput,
  actor: ExpenseActor,
): Promise<{ category?: SerializedExpenseCategory; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.expenseCategory) {
    try {
      const db = readDB()
      db.expenseCategories = db.expenseCategories || []
      if (db.expenseCategories.find(c => c.slug === input.slug)) {
        return { error: 'Já existe uma categoria com este slug.' }
      }
      const id = generateId('cat')
      const record = {
        id,
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description?.trim() ?? null,
        defaultType: input.defaultType ?? null,
        costCenter: input.costCenter ?? null,
        color: input.color ?? null,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      }
      db.expenseCategories.push(record)
      writeDB(db)
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense_category.create',
        targetType: 'ExpenseCategory',
        targetId: id,
        summary: `Categoria "${record.name}" criada`,
      }).catch(() => {})
      return { category: serializeCategoryRow(record) }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'createCategory localDb failed' })
      return { error: 'Erro ao criar categoria.' }
    }
  }

  try {
    const row = await (prisma as any).expenseCategory.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description?.trim() || null,
        defaultType: input.defaultType || null,
        costCenter: input.costCenter || null,
        color: input.color || null,
        isActive: input.isActive ?? true,
      },
    })
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense_category.create',
      targetType: 'ExpenseCategory',
      targetId: row.id,
      summary: `Categoria "${row.name}" criada`,
    }).catch(() => {})
    return { category: serializeCategoryRow(row) }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return { error: 'Já existe uma categoria com este slug.' }
    }
    captureException(err, { context: 'expenses', detail: 'createCategory Prisma failed' })
    return { error: 'Erro ao criar categoria.' }
  }
}

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  actor: ExpenseActor,
): Promise<{ category?: SerializedExpenseCategory; error?: string }> {
  const now = new Date().toISOString()

  if (!hasDatabase || !(prisma as any)?.expenseCategory) {
    try {
      const db = readDB()
      const idx = (db.expenseCategories || []).findIndex(c => c.id === id)
      if (idx === -1) return { error: 'Categoria não encontrada.' }
      if (
        input.slug !== undefined &&
        db.expenseCategories.find(c => c.slug === input.slug && c.id !== id)
      ) {
        return { error: 'Já existe uma categoria com este slug.' }
      }
      const updated = {
        ...db.expenseCategories[idx],
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
        ...(input.defaultType !== undefined ? { defaultType: input.defaultType ?? null } : {}),
        ...(input.costCenter !== undefined ? { costCenter: input.costCenter ?? null } : {}),
        ...(input.color !== undefined ? { color: input.color ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: now,
      }
      db.expenseCategories[idx] = updated
      writeDB(db)
      await recordAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'expense_category.update',
        targetType: 'ExpenseCategory',
        targetId: id,
        summary: `Categoria "${updated.name}" atualizada`,
      }).catch(() => {})
      return { category: serializeCategoryRow(updated) }
    } catch (err) {
      captureException(err, { context: 'expenses', detail: 'updateCategory localDb failed' })
      return { error: 'Erro ao atualizar categoria.' }
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.slug !== undefined) data.slug = input.slug.trim()
    if (input.description !== undefined) data.description = input.description?.trim() || null
    if (input.defaultType !== undefined) data.defaultType = input.defaultType || null
    if (input.costCenter !== undefined) data.costCenter = input.costCenter || null
    if (input.color !== undefined) data.color = input.color || null
    if (input.isActive !== undefined) data.isActive = input.isActive

    const row = await (prisma as any).expenseCategory.update({
      where: { id },
      data,
    })
    await recordAuditEntry({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'expense_category.update',
      targetType: 'ExpenseCategory',
      targetId: id,
      summary: `Categoria "${row.name}" atualizada`,
    }).catch(() => {})
    return { category: serializeCategoryRow(row) }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { error: 'Categoria não encontrada.' }
    if ((err as { code?: string }).code === 'P2002') return { error: 'Já existe uma categoria com este slug.' }
    captureException(err, { context: 'expenses', detail: 'updateCategory Prisma failed' })
    return { error: 'Erro ao atualizar categoria.' }
  }
}
