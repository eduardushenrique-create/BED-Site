'use client'

import Link from 'next/link'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'

export type ExpenseItem = {
  id: string
  title: string
  supplierName: string | null
  categoryId: string | null
  categoryName: string | null
  type: 'fixed' | 'variable' | 'one_time'
  status: 'pending' | 'paid' | 'canceled' | 'overdue'
  amount: string
  competenceDate: string | null
  dueDate: string | null
}

type Props = {
  expenses: ExpenseItem[]
  isLoading?: boolean
}

const th: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6B7494',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = { padding: '12px 16px', fontSize: '14px', color: '#1D2235' }

const TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixa',
  variable: 'Variavel',
  one_time: 'Pontual',
}

function formatBRL(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function formatCompetence(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

function SkeletonRow() {
  return (
    <tr style={{ borderTop: '1px solid #E3E9F4' }}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <td key={i} style={td}>
          <div style={{ height: '16px', background: '#E3E9F4', borderRadius: '4px', width: i === 1 ? '140px' : '80px' }} />
        </td>
      ))}
    </tr>
  )
}

export function ExpenseTable({ expenses, isLoading = false }: Props) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FBFD' }}>
              <th style={th}>Titulo / Fornecedor</th>
              <th style={th}>Categoria</th>
              <th style={th}>Tipo</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Valor</th>
              <th style={th}>Competencia</th>
              <th style={th}>Vencimento</th>
              <th style={{ ...th, textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...td, textAlign: 'center', padding: '40px 16px', color: '#6B7494' }}>
                  Nenhuma despesa encontrada.
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <tr key={expense.id} style={{ borderTop: '1px solid #E3E9F4' }}>
                  <td style={td}>
                    <Link href={`/admin/despesas/${expense.id}`} style={{ color: '#1D2235', textDecoration: 'none', fontWeight: 600 }}>
                      {expense.title}
                    </Link>
                    {expense.supplierName && (
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7494' }}>{expense.supplierName}</p>
                    )}
                  </td>
                  <td style={{ ...td, color: '#6B7494' }}>{expense.categoryName || '—'}</td>
                  <td style={td}>
                    <span style={{ background: '#E4EDF8', color: '#4A7AB5', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>
                      {TYPE_LABELS[expense.type] ?? expense.type}
                    </span>
                  </td>
                  <td style={td}>
                    <ExpenseStatusBadge status={expense.status} />
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {formatBRL(expense.amount)}
                  </td>
                  <td style={{ ...td, color: '#6B7494' }}>{formatCompetence(expense.competenceDate)}</td>
                  <td style={{ ...td, color: expense.status === 'overdue' ? '#B42318' : '#6B7494' }}>
                    {formatDate(expense.dueDate)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <Link
                      href={`/admin/despesas/${expense.id}`}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textDecoration: 'none', color: '#1D2235', display: 'inline-block' }}
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
