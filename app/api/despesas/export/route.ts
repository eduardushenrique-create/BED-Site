import { NextRequest, NextResponse } from 'next/server'
import { requireApiRole } from '@/lib/api-auth'
import { PRIVILEGED_ROLES } from '@/lib/auth-shared'
import { listExpenses } from '@/lib/expenses'
import { recordAuditEntry } from '@/lib/audit-log'
import {
  consumeRateLimit,
  buildRateLimitKey,
  rateLimitResponseBody,
} from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// CSV helpers ------------------------------------------------------------

function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  // Wrap in double-quotes if the value contains a comma, newline, or double-quote
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',')
}

// GET /api/despesas/export
// Rate-limit: 10 requests / 300 seconds per actor email
// Same filters as GET /api/despesas
// Returns CSV with Content-Disposition: attachment
export async function GET(request: NextRequest) {
  // M1 — export de dados financeiros: restrito a papéis de alta alçada.
  const auth = await requireApiRole(PRIVILEGED_ROLES)
  if (auth.response) return auth.response

  // Rate-limit check (keyed by actor email)
  const rateLimitKey = buildRateLimitKey('expense-export', auth.user!.email ?? '')
  const rl = await consumeRateLimit(rateLimitKey, 10, 300)
  if (!rl.ok) {
    const { body, status, headers } = rateLimitResponseBody(rl)
    return NextResponse.json(body, { status, headers })
  }

  const { searchParams } = new URL(request.url)

  const filters = {
    q: searchParams.get('q') || undefined,
    status: searchParams.get('status') || undefined,
    categoryId: searchParams.get('categoryId') || undefined,
    type: searchParams.get('type') || undefined,
    costCenter: searchParams.get('costCenter') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    includeArchived:
      searchParams.get('includeArchived') === '1' ||
      searchParams.get('includeArchived') === 'true',
    // Fetch all rows for export — up to 5000 max
    page: 1,
    limit: 5000,
  }

  const { expenses } = await listExpenses(filters)

  // Build CSV
  const CSV_HEADER =
    'id,titulo,descricao,valor,categoria,fornecedor,tipo,status,forma_pagamento,' +
    'centro_custo,competencia,vencimento,pagamento,nota_fiscal,comprovante,' +
    'filamento,componente,impressora,criado_em,atualizado_em'

  const rows = expenses.map(e =>
    toCsvRow([
      e.id,
      e.title,
      e.description,
      e.amount,
      e.categoryName ?? e.categoryId,
      e.supplierName,
      e.type,
      e.status,
      e.paymentMethod,
      e.costCenter,
      e.competenceDate,
      e.dueDate,
      e.paidAt,
      e.invoiceNumber,
      e.receiptUrl,
      e.relatedFilamentName ?? e.relatedFilamentId,
      e.relatedComponentName ?? e.relatedComponentId,
      e.relatedPrinterName ?? e.relatedPrinterId,
      e.createdAt,
      e.updatedAt,
    ]),
  )

  const csv = [CSV_HEADER, ...rows].join('\r\n')

  // Filename: despesas-YYYY-MM.csv using the current month
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const filename = `despesas-${yyyy}-${mm}.csv`

  // Audit log (best-effort)
  await recordAuditEntry({
    actorEmail: auth.user!.email ?? '',
    actorRole: auth.user!.role,
    action: 'expense.export',
    targetType: 'CompanyExpense',
    summary: `Exportação de despesas — ${expenses.length} registro(s)`,
    metadata: { filters, rowCount: expenses.length },
  }).catch(() => {})

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
