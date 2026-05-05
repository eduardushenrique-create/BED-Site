import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { generateExpenseReport, currentMonthRange } from '@/lib/expenseReports'

export const dynamic = 'force-dynamic'

// GET /api/despesas/relatorios
// Query: startDate, endDate (default = current month in America/Sao_Paulo)
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)

  let startDate = searchParams.get('startDate') || ''
  let endDate = searchParams.get('endDate') || ''

  if (!startDate || !endDate) {
    const range = currentMonthRange('America/Sao_Paulo')
    startDate = startDate || range.startDate
    endDate = endDate || range.endDate
  }

  // Basic ISO date validation
  if (isNaN(Date.parse(startDate))) {
    return NextResponse.json({ error: 'startDate inválido.' }, { status: 400 })
  }
  if (isNaN(Date.parse(endDate))) {
    return NextResponse.json({ error: 'endDate inválido.' }, { status: 400 })
  }
  if (new Date(startDate) > new Date(endDate)) {
    return NextResponse.json(
      { error: 'startDate deve ser anterior ou igual a endDate.' },
      { status: 400 },
    )
  }

  const report = await generateExpenseReport(startDate, endDate)

  return NextResponse.json({
    period: { startDate, endDate },
    totals: report.totals,
    byCategory: report.byCategory,
    byCostCenter: report.byCostCenter,
    byType: report.byType,
    topSuppliers: report.topSuppliers,
  })
}
