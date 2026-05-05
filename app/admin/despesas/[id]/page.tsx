'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExpenseStatusBadge } from '@/components/admin/expenses/ExpenseStatusBadge'
import { ExpenseActionsMenu } from '@/components/admin/expenses/ExpenseActionsMenu'
import { ExpenseForm, type ExpenseFormData } from '@/components/admin/expenses/ExpenseForm'

type Expense = {
  id: string
  title: string
  amount: string
  categoryId: string | null
  categoryName: string | null
  type: 'fixed' | 'variable' | 'one_time'
  status: 'pending' | 'paid' | 'canceled' | 'overdue'
  paymentMethod: string | null
  costCenter: string | null
  competenceDate: string | null
  dueDate: string | null
  paidAt: string | null
  supplierName: string | null
  invoiceNumber: string | null
  receiptUrl: string | null
  relatedFilamentId: string | null
  relatedFilamentName: string | null
  relatedComponentId: string | null
  relatedComponentName: string | null
  relatedPrinterId: string | null
  relatedPrinterName: string | null
  notes: string | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '10px 0', borderBottom: '1px solid #F0F5FB' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7494' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#1D2235' }}>{value || '—'}</span>
    </div>
  )
}

export default function DespesaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/despesas/${id}`, { cache: 'no-store' })
      if (res.status === 404) {
        setError('Despesa nao encontrada.')
        return
      }
      if (res.status === 403) {
        setError('Acesso negado.')
        return
      }
      if (!res.ok) {
        setError('Erro ao carregar despesa.')
        return
      }
      const data = await res.json()
      setExpense(data.expense ?? data)
    } catch {
      setError('Erro de conexao.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  if (loading) {
    return (
      <div>
        <div style={{ height: '24px', width: '200px', background: '#E3E9F4', borderRadius: '6px', marginBottom: '16px' }} />
        <div style={{ height: '40px', width: '300px', background: '#E3E9F4', borderRadius: '8px', marginBottom: '8px' }} />
        <div style={{ height: '280px', background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
          {error}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={load} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
            Tentar novamente
          </button>
          <Link href="/admin/despesas" style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', textDecoration: 'none', color: '#1D2235', fontWeight: 600, display: 'inline-block' }}>
            Voltar para despesas
          </Link>
        </div>
      </div>
    )
  }

  if (!expense) return null

  const formInitial: Partial<ExpenseFormData> = {
    title: expense.title,
    amount: expense.amount,
    categoryId: expense.categoryId ?? '',
    type: expense.type,
    status: expense.status,
    paymentMethod: expense.paymentMethod ?? '',
    costCenter: expense.costCenter ?? '',
    competenceDate: expense.competenceDate ? expense.competenceDate.slice(0, 10) : '',
    dueDate: expense.dueDate ? expense.dueDate.slice(0, 10) : '',
    paidAt: expense.paidAt ? expense.paidAt.slice(0, 10) : '',
    supplierName: expense.supplierName ?? '',
    invoiceNumber: expense.invoiceNumber ?? '',
    receiptUrl: expense.receiptUrl ?? '',
    relatedFilamentId: expense.relatedFilamentId ?? '',
    relatedComponentId: expense.relatedComponentId ?? '',
    relatedPrinterId: expense.relatedPrinterId ?? '',
    notes: expense.notes ?? '',
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Link href="/admin/despesas" style={{ color: '#4A7AB5', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
          Despesas
        </Link>
        <span style={{ color: '#6B7494', fontSize: '13px' }}>/</span>
        <span style={{ color: '#6B7494', fontSize: '13px' }}>{expense.title}</span>
      </div>

      {/* Header */}
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', color: '#1D2235', margin: 0 }}>{expense.title}</h1>
            <ExpenseStatusBadge status={expense.status} />
            {expense.isArchived && (
              <span style={{ background: '#F3F4F6', color: '#6B7494', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>
                Arquivada
              </span>
            )}
          </div>
          <p style={{ color: '#1D7A72', margin: 0, fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {formatBRL(expense.amount)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          style={{ padding: '10px 18px', borderRadius: '10px', background: editing ? '#F3F4F6' : 'white', color: '#1D2235', border: '1px solid #D8DCE8', fontWeight: 600, cursor: 'pointer' }}
        >
          {editing ? 'Cancelar edicao' : 'Editar'}
        </button>
      </header>

      {/* Acoes rapidas */}
      {!editing && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#6B7494', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Acoes
          </p>
          <ExpenseActionsMenu
            id={expense.id}
            status={expense.status}
            isArchived={expense.isArchived}
            onActionDone={load}
          />
        </div>
      )}

      {/* Formulario de edicao inline */}
      {editing ? (
        <ExpenseForm
          expenseId={expense.id}
          initialData={formInitial}
          onSuccess={() => {
            setEditing(false)
            load()
          }}
        />
      ) : (
        <>
          {/* Detalhes */}
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Detalhes
            </h2>
            <InfoRow label="Tipo" value={TYPE_LABELS[expense.type] ?? expense.type} />
            <InfoRow label="Categoria" value={expense.categoryName} />
            <InfoRow label="Centro de custo" value={expense.costCenter} />
            <InfoRow label="Forma de pagamento" value={expense.paymentMethod} />
            <InfoRow label="Competencia" value={formatDate(expense.competenceDate)} />
            <InfoRow label="Vencimento" value={formatDate(expense.dueDate)} />
            <InfoRow label="Pago em" value={formatDate(expense.paidAt)} />
            <InfoRow label="Fornecedor" value={expense.supplierName} />
            <InfoRow label="Nota fiscal" value={expense.invoiceNumber} />
            {expense.receiptUrl && (
              <InfoRow
                label="Comprovante"
                value={
                  <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4A7AB5' }}>
                    Ver comprovante
                  </a>
                }
              />
            )}
            {expense.notes && (
              <InfoRow label="Observacoes" value={<span style={{ whiteSpace: 'pre-wrap' }}>{expense.notes}</span>} />
            )}
          </div>

          {/* Itens vinculados */}
          {(expense.relatedFilamentId || expense.relatedComponentId || expense.relatedPrinterId) && (
            <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Insumos vinculados
              </h2>
              {expense.relatedFilamentId && (
                <InfoRow
                  label="Filamento"
                  value={
                    <Link href={`/admin/filamentos`} style={{ color: '#4A7AB5', textDecoration: 'none', fontWeight: 600 }}>
                      {expense.relatedFilamentName ?? expense.relatedFilamentId}
                    </Link>
                  }
                />
              )}
              {expense.relatedComponentId && (
                <InfoRow
                  label="Componente"
                  value={
                    <Link href={`/admin/componentes/${expense.relatedComponentId}`} style={{ color: '#4A7AB5', textDecoration: 'none', fontWeight: 600 }}>
                      {expense.relatedComponentName ?? expense.relatedComponentId}
                    </Link>
                  }
                />
              )}
              {expense.relatedPrinterId && (
                <InfoRow
                  label="Impressora"
                  value={
                    <Link href={`/admin/impressoras/${expense.relatedPrinterId}`} style={{ color: '#4A7AB5', textDecoration: 'none', fontWeight: 600 }}>
                      {expense.relatedPrinterName ?? expense.relatedPrinterId}
                    </Link>
                  }
                />
              )}
            </div>
          )}

          {/* Auditoria */}
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Historico
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#6B7494' }}>Criado em</span>
                <span style={{ color: '#1D2235', fontFamily: 'var(--font-mono)' }}>{formatDateTime(expense.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#6B7494' }}>Ultima atualizacao</span>
                <span style={{ color: '#1D2235', fontFamily: 'var(--font-mono)' }}>{formatDateTime(expense.updatedAt)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
