import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB } from '@/lib/localDb'
import { deriveStatus } from '@/lib/expenses'
import { captureException } from '@/lib/observability'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportTotals = {
  paid: string
  pending: string
  overdue: string
  canceled: string
  total: string
}

export type ByCategoryItem = {
  categoryId: string
  categoryName: string
  total: string
  count: number
}

export type ByCostCenterItem = {
  costCenter: string
  total: string
  count: number
}

export type ByTypeItem = {
  type: string
  total: string
  count: number
}

export type TopSupplierItem = {
  supplierName: string
  total: string
  count: number
}

export type ExpenseReport = {
  startDate: string
  endDate: string
  totals: ReportTotals
  byCategory: ByCategoryItem[]
  byCostCenter: ByCostCenterItem[]
  byType: ByTypeItem[]
  topSuppliers: TopSupplierItem[]
}

// ---------------------------------------------------------------------------
// TZ helpers
// ---------------------------------------------------------------------------

/**
 * Returns { year, month } of a date in the given IANA timezone.
 * Falls back to UTC if Intl is unavailable.
 */
export function monthOf(
  date: Date,
  tz = 'America/Sao_Paulo',
): { year: number; month: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
    })
    const parts = fmt.formatToParts(date)
    const year = parseInt(parts.find(p => p.type === 'year')?.value ?? '0', 10)
    const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '0', 10)
    return { year, month }
  } catch {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
  }
}

/**
 * Returns the start/end of the current month in America/Sao_Paulo as ISO strings.
 */
export function currentMonthRange(tz = 'America/Sao_Paulo'): { startDate: string; endDate: string } {
  const { year, month } = monthOf(new Date(), tz)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`
  // last day of month: set to first day of next month, then subtract 1ms
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endDate = new Date(
    Date.UTC(nextYear, nextMonth - 1, 1) - 1,
  ).toISOString()
  return { startDate, endDate }
}

// ---------------------------------------------------------------------------
// buildReportSummary (from in-memory expense list)
// ---------------------------------------------------------------------------

type MinimalExpense = {
  status: string
  dueDate?: string | null
  amount: string
  categoryId: string
  categoryName?: string | null
  costCenter: string
  type: string
  supplierName?: string | null
}

export function buildReportSummary(
  expenses: MinimalExpense[],
  startDate: string,
  endDate: string,
): ExpenseReport {
  let paid = 0
  let pending = 0
  let overdue = 0
  let canceled = 0

  const categoryMap = new Map<string, { name: string; total: number; count: number }>()
  const costCenterMap = new Map<string, { total: number; count: number }>()
  const typeMap = new Map<string, { total: number; count: number }>()
  const supplierMap = new Map<string, { total: number; count: number }>()

  for (const exp of expenses) {
    const amount = parseFloat(exp.amount) || 0
    const status = deriveStatus({ status: exp.status, dueDate: exp.dueDate })

    if (status === 'paid') paid += amount
    else if (status === 'canceled') canceled += amount
    else if (status === 'overdue') overdue += amount
    else pending += amount

    // By category
    const catKey = exp.categoryId
    const existing = categoryMap.get(catKey)
    if (existing) {
      existing.total += amount
      existing.count += 1
    } else {
      categoryMap.set(catKey, {
        name: exp.categoryName ?? exp.categoryId,
        total: amount,
        count: 1,
      })
    }

    // By cost center
    const ccExisting = costCenterMap.get(exp.costCenter)
    if (ccExisting) {
      ccExisting.total += amount
      ccExisting.count += 1
    } else {
      costCenterMap.set(exp.costCenter, { total: amount, count: 1 })
    }

    // By type
    const typeExisting = typeMap.get(exp.type)
    if (typeExisting) {
      typeExisting.total += amount
      typeExisting.count += 1
    } else {
      typeMap.set(exp.type, { total: amount, count: 1 })
    }

    // Top suppliers
    if (exp.supplierName) {
      const supExisting = supplierMap.get(exp.supplierName)
      if (supExisting) {
        supExisting.total += amount
        supExisting.count += 1
      } else {
        supplierMap.set(exp.supplierName, { total: amount, count: 1 })
      }
    }
  }

  const total = paid + pending + overdue + canceled

  const byCategory: ByCategoryItem[] = Array.from(categoryMap.entries())
    .map(([categoryId, v]) => ({
      categoryId,
      categoryName: v.name,
      total: v.total.toFixed(2),
      count: v.count,
    }))
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))

  const byCostCenter: ByCostCenterItem[] = Array.from(costCenterMap.entries())
    .map(([costCenter, v]) => ({
      costCenter,
      total: v.total.toFixed(2),
      count: v.count,
    }))
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))

  const byType: ByTypeItem[] = Array.from(typeMap.entries())
    .map(([type, v]) => ({
      type,
      total: v.total.toFixed(2),
      count: v.count,
    }))
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))

  const topSuppliers: TopSupplierItem[] = Array.from(supplierMap.entries())
    .map(([supplierName, v]) => ({
      supplierName,
      total: v.total.toFixed(2),
      count: v.count,
    }))
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
    .slice(0, 10)

  return {
    startDate,
    endDate,
    totals: {
      paid: paid.toFixed(2),
      pending: pending.toFixed(2),
      overdue: overdue.toFixed(2),
      canceled: canceled.toFixed(2),
      total: total.toFixed(2),
    },
    byCategory,
    byCostCenter,
    byType,
    topSuppliers,
  }
}

// ---------------------------------------------------------------------------
// generateReport — fetches data and builds report
// ---------------------------------------------------------------------------

export async function generateExpenseReport(
  startDate: string,
  endDate: string,
): Promise<ExpenseReport> {
  if (!hasDatabase || !(prisma as any)?.companyExpense) {
    const db = readDB()
    const expenses = (db.expenses || [])
      .filter(e => e.archivedAt == null)
      .filter(e => e.competenceDate >= startDate && e.competenceDate <= endDate)
      .map(e => {
        const cat = db.expenseCategories?.find(c => c.id === e.categoryId)
        return {
          status: e.status,
          dueDate: e.dueDate,
          amount: e.amount,
          categoryId: e.categoryId,
          categoryName: cat?.name ?? null,
          costCenter: e.costCenter,
          type: e.type,
          supplierName: e.supplierName,
        }
      })

    return buildReportSummary(expenses, startDate, endDate)
  }

  try {
    const rows = await (prisma as any).companyExpense.findMany({
      where: {
        archivedAt: null,
        competenceDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        status: true,
        dueDate: true,
        amount: true,
        categoryId: true,
        category: { select: { name: true } },
        costCenter: true,
        type: true,
        supplierName: true,
      },
    })

    const expenses: MinimalExpense[] = rows.map((r: {
      status: string
      dueDate: Date | null
      amount: { toString(): string }
      categoryId: string
      category: { name: string } | null
      costCenter: string
      type: string
      supplierName: string | null
    }) => ({
      status: r.status,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      amount: r.amount.toString(),
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      costCenter: r.costCenter,
      type: r.type,
      supplierName: r.supplierName,
    }))

    return buildReportSummary(expenses, startDate, endDate)
  } catch (err) {
    captureException(err, { context: 'expenseReports', detail: 'generateExpenseReport Prisma failed' })
    return buildReportSummary([], startDate, endDate)
  }
}
