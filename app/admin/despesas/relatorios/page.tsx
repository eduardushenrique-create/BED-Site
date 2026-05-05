'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportTotals = {
  paid: string
  pending: string
  overdue: string
  canceled: string
  total: string
}

type ByCategoryItem = {
  categoryId: string
  categoryName: string
  total: string
  count: number
}

type ByCostCenterItem = {
  costCenter: string
  total: string
  count: number
}

type ByTypeItem = {
  type: string
  total: string
  count: number
}

type TopSupplierItem = {
  supplierName: string
  total: string
  count: number
}

type ReportResponse = {
  period: { startDate: string; endDate: string }
  totals: ReportTotals
  byCategory: ByCategoryItem[]
  byCostCenter: ByCostCenterItem[]
  byType: ByTypeItem[]
  topSuppliers: TopSupplierItem[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function currentMonthISO(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function monthStartISO(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function monthEndISO(year: number, month: number): string {
  // last day: first day of next month minus 1 day
  const d = new Date(year, month, 0) // month is already 1-indexed; Date(year, month, 0) = last day of month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TotalCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '14px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          fontWeight: 700,
          color: '#6B7494',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: '22px',
          fontWeight: 700,
          color: accent,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}
      </p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '14px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        borderTop: '3px solid #E3E9F4',
      }}
    >
      <div
        style={{
          height: '12px',
          width: '80px',
          background: '#E3E9F4',
          borderRadius: '4px',
          marginBottom: '12px',
        }}
      />
      <div
        style={{
          height: '28px',
          width: '120px',
          background: '#E3E9F4',
          borderRadius: '6px',
        }}
      />
    </div>
  )
}

const tableHeaderCell: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#6B7494',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
  borderBottom: '1px solid #E3E9F4',
  background: '#F7F9FC',
}

const tableCell: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '14px',
  color: '#1D2235',
  borderBottom: '1px solid #F0F3FA',
}

const tableCellRight: React.CSSProperties = {
  ...tableCell,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
}

function SectionTable({
  title,
  headers,
  rows,
}: {
  title: string
  headers: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <section
      style={{
        backgroundColor: 'white',
        borderRadius: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        marginBottom: '24px',
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E3E9F4' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1D2235' }}>
          {title}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p style={{ padding: '24px', color: '#6B7494', margin: 0, textAlign: 'center' }}>
          Sem dados para o periodo selecionado.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} style={tableHeaderCell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, i) => (
                <tr key={i}>
                  {cells.map((cell, j) => (
                    <td
                      key={j}
                      style={
                        j === 0
                          ? tableCell
                          : j === cells.length - 1
                            ? { ...tableCell, textAlign: 'right' }
                            : tableCellRight
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RelatoriosDespesasPage() {
  const { year: currentYear, month: currentMonth } = currentMonthISO()

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (year: number, month: number) => {
    setLoading(true)
    setError('')
    try {
      const startDate = monthStartISO(year, month)
      const endDate = monthEndISO(year, month)
      const params = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/despesas/relatorios?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setError('Erro ao carregar relatorio.')
        return
      }
      const json: ReportResponse = await res.json()
      setReport(json)
    } catch {
      setError('Erro de conexao.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(selectedYear, selectedMonth)
  }, [selectedYear, selectedMonth, load])

  // Build year options: current year and up to 3 years back
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - i)

  const monthOptions = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Marco' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ]

  const selectStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #D8DCE8',
    fontSize: '14px',
    background: 'white',
    color: '#1D2235',
    cursor: 'pointer',
  }

  return (
    <div>
      <header style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Link
            href="/admin/despesas"
            style={{ color: '#4A7AB5', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}
          >
            Despesas
          </Link>
          <span style={{ color: '#6B7494', fontSize: '13px' }}>/</span>
          <span style={{ color: '#6B7494', fontSize: '13px' }}>Relatorios</span>
        </div>
        <p
          style={{
            fontSize: '12px',
            color: '#4A7AB5',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Financeiro
        </p>
        <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', color: '#1D2235', margin: '6px 0 4px' }}>
          Relatorios de Despesas
        </h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          Totais e agrupamentos por categoria, centro de custo e fornecedor.
        </p>
      </header>

      {/* Period selector */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: '14px', fontWeight: 600, color: '#1D2235' }}>
          Periodo:
        </label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          style={selectStyle}
          aria-label="Selecionar mes"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          style={selectStyle}
          aria-label="Selecionar ano"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {loading && (
          <span style={{ fontSize: '13px', color: '#6B7494', fontStyle: 'italic' }}>
            Carregando...
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            background: '#FEE2E2',
            color: '#B42318',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => load(selectedYear, selectedMonth)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #FCA5A5',
              background: 'white',
              color: '#B42318',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* KPI totals */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {loading && !report ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <TotalCard
              label="Pago"
              value={report ? formatBRL(report.totals.paid) : 'R$ 0,00'}
              accent="#1D7A72"
            />
            <TotalCard
              label="Pendente"
              value={report ? formatBRL(report.totals.pending) : 'R$ 0,00'}
              accent="#92400E"
            />
            <TotalCard
              label="Vencido"
              value={report ? formatBRL(report.totals.overdue) : 'R$ 0,00'}
              accent="#B42318"
            />
            <TotalCard
              label="Cancelado"
              value={report ? formatBRL(report.totals.canceled) : 'R$ 0,00'}
              accent="#6B7494"
            />
          </>
        )}
      </div>

      {/* Tables — only render when not in the initial loading skeleton state */}
      {!loading || report ? (
        <>
          {/* By Category */}
          <SectionTable
            title="Por Categoria"
            headers={['Categoria', 'Total', 'Qtd']}
            rows={
              report?.byCategory.map((row) => [
                row.categoryName,
                formatBRL(row.total),
                String(row.count),
              ]) ?? []
            }
          />

          {/* By Cost Center */}
          <SectionTable
            title="Por Centro de Custo"
            headers={['Centro de Custo', 'Total', 'Qtd']}
            rows={
              report?.byCostCenter.map((row) => [
                row.costCenter,
                formatBRL(row.total),
                String(row.count),
              ]) ?? []
            }
          />

          {/* By Type */}
          <SectionTable
            title="Por Tipo"
            headers={['Tipo', 'Total', 'Qtd']}
            rows={
              report?.byType.map((row) => [
                row.type,
                formatBRL(row.total),
                String(row.count),
              ]) ?? []
            }
          />

          {/* Top Suppliers */}
          <SectionTable
            title="Top Fornecedores"
            headers={['Fornecedor', 'Total', 'Qtd']}
            rows={
              report?.topSuppliers.map((row) => [
                row.supplierName,
                formatBRL(row.total),
                String(row.count),
              ]) ?? []
            }
          />
        </>
      ) : null}
    </div>
  )
}
