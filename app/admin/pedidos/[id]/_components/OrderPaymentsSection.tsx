'use client'

import { useCallback, useEffect, useState } from 'react'
import RegisterInstallmentModal from './RegisterInstallmentModal'

/**
 * SPEC-005 §3.2.4 — Seção de pagamentos no admin do pedido.
 *
 * Mostra: total / pago / saldo + lista de installments + botão de
 * registrar pagamento. Self-contained: fetch interno, gerencia estado
 * próprio, recarrega ao registrar/editar/remover.
 */

type Installment = {
  id: string
  sequence: number
  amount: number
  method: string
  description: string | null
  receivedAt: string
  receivedByEmail: string
  notes: string | null
  isRefund: boolean
}

type Totals = {
  total: number
  paidAmount: number
  dueAmount: number
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  pix_manual: 'PIX (manual)',
  bank_transfer: 'Transferência',
  mercadopago: 'Mercado Pago',
  other: 'Outro',
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

interface Props {
  orderId: string
  orderTotal: number
  initialPaidAmount: number
  initialDueAmount: number
  refundStatus: string | null
}

export default function OrderPaymentsSection({
  orderId,
  orderTotal,
  initialPaidAmount,
  initialDueAmount,
  refundStatus,
}: Props) {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [totals, setTotals] = useState<Totals>({
    total: orderTotal,
    paidAmount: initialPaidAmount,
    dueAmount: initialDueAmount,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pedidos/${orderId}/installments`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setInstallments(data.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar parcelas')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleCreated = (result: { totals: Totals }) => {
    setTotals(result.totals)
    void reload()
    setModalOpen(false)
  }

  const handleDelete = async (installmentId: string) => {
    const reason = window.prompt(
      'Por que está removendo esta parcela? (mínimo 5 caracteres)',
    )
    if (!reason || reason.trim().length < 5) return

    try {
      const res = await fetch(
        `/api/pedidos/${orderId}/installments/${installmentId}?reason=${encodeURIComponent(reason)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setTotals(data.totals)
      void reload()
    } catch (e) {
      alert(`Erro ao remover: ${e instanceof Error ? e.message : 'desconhecido'}`)
    }
  }

  const isPartial = totals.paidAmount > 0 && totals.paidAmount < totals.total
  const isFullyPaid = totals.paidAmount >= totals.total && totals.total > 0
  const hasDue = totals.dueAmount > 0

  // Cores dos tiles seguem semântica: pago em verde quando quitado,
  // âmbar quando parcial; saldo em verde quando zero, âmbar quando devido.
  const paidColor = isFullyPaid ? '#0E9F6E' : isPartial ? '#B26A00' : '#1D2235'
  const paidBg = isFullyPaid ? '#DFF4EC' : isPartial ? '#FEF3C7' : '#F0F5FB'
  const dueColor = hasDue ? '#B26A00' : '#0E9F6E'
  const dueBg = hasDue ? '#FEF3C7' : '#DFF4EC'

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Pagamentos</h2>
          <p style={{ fontSize: '13px', color: '#6B7494', margin: '4px 0 0' }}>
            Parcelas recebidas e estornos registrados manualmente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            padding: '10px 18px',
            backgroundColor: '#1D2235',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          + Registrar pagamento
        </button>
      </div>

      {/* Totais */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <SummaryTile
          label="Total do pedido"
          value={formatBRL(totals.total)}
          bg="#F0F5FB"
          color="#1D2235"
        />
        <SummaryTile
          label="Pago"
          value={formatBRL(totals.paidAmount)}
          bg={paidBg}
          color={paidColor}
        />
        <SummaryTile
          label="Saldo a receber"
          value={formatBRL(totals.dueAmount)}
          bg={dueBg}
          color={dueColor}
        />
      </div>

      {/* Aviso de reembolso pendente */}
      {refundStatus === 'manual_required' && (
        <div
          style={{
            marginBottom: '16px',
            borderRadius: '10px',
            border: '1px solid #F59E0B',
            backgroundColor: '#FEF3C7',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#92400E',
            lineHeight: 1.55,
          }}
        >
          <strong>Reembolso pendente:</strong> este pedido teve itens cancelados
          após o pagamento. Verifique o saldo a estornar manualmente.
        </div>
      )}

      {/* Estados */}
      {loading && (
        <p style={{ fontSize: '13px', color: '#6B7494', margin: 0 }}>Carregando…</p>
      )}
      {error && !loading && (
        <div
          style={{
            borderRadius: '8px',
            border: '1px solid #EF4444',
            backgroundColor: '#FEE2E2',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#B42318',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && installments.length === 0 && (
        <div
          style={{
            borderRadius: '10px',
            border: '1px dashed #D8DCE8',
            backgroundColor: '#FAFBFD',
            padding: '24px 16px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, color: '#6B7494', fontSize: '14px' }}>
            Nenhum pagamento registrado ainda.
          </p>
          <p style={{ margin: '4px 0 0', color: '#9AA2B8', fontSize: '12px' }}>
            Use “Registrar pagamento” para lançar a primeira parcela.
          </p>
        </div>
      )}

      {!loading && installments.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {installments.map((i) => (
            <InstallmentRow key={i.id} installment={i} onDelete={handleDelete} />
          ))}
        </ul>
      )}

      {modalOpen && (
        <RegisterInstallmentModal
          orderId={orderId}
          dueAmountSuggestion={totals.dueAmount}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

// ---------------- helpers visuais ----------------

function SummaryTile({
  label,
  value,
  bg,
  color,
}: {
  label: string
  value: string
  bg: string
  color: string
}) {
  return (
    <div
      style={{
        backgroundColor: bg,
        borderRadius: '10px',
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#6B7494',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color,
          fontFamily: 'var(--font-mono)',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function InstallmentRow({
  installment: i,
  onDelete,
}: {
  installment: Installment
  onDelete: (id: string) => void
}) {
  const methodLabel = METHOD_LABELS[i.method] || i.method
  const amountColor = i.isRefund ? '#B42318' : '#0E9F6E'
  const sign = i.isRefund ? '−' : '+'

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '10px',
        border: '1px solid #EEF1F8',
        backgroundColor: '#FAFBFD',
      }}
    >
      {/* Sequência */}
      <div
        style={{
          flexShrink: 0,
          width: '28px',
          height: '28px',
          borderRadius: '999px',
          backgroundColor: 'white',
          border: '1px solid #D8DCE8',
          color: '#6B7494',
          fontSize: '12px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
        }}
      >
        {i.sequence}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '15px',
              fontWeight: 700,
              color: amountColor,
            }}
          >
            {sign} {formatBRL(i.amount)}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#1D2235',
              backgroundColor: '#E8EEF8',
              padding: '2px 8px',
              borderRadius: '999px',
              letterSpacing: '0.02em',
            }}
          >
            {methodLabel}
          </span>
          {i.isRefund && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#B42318',
                backgroundColor: '#FEE2E2',
                padding: '2px 8px',
                borderRadius: '999px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Estorno
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7494', marginTop: '4px' }}>
          {formatDate(i.receivedAt)} · por {i.receivedByEmail}
          {i.description ? ` · ${i.description}` : ''}
        </div>
        {i.notes && (
          <div
            style={{
              fontSize: '12px',
              color: '#6B7494',
              marginTop: '6px',
              fontStyle: 'italic',
              backgroundColor: 'white',
              border: '1px solid #EEF1F8',
              borderRadius: '6px',
              padding: '6px 8px',
            }}
          >
            {i.notes}
          </div>
        )}
      </div>

      {/* Ação */}
      <button
        type="button"
        onClick={() => onDelete(i.id)}
        title="Remover (com motivo)"
        style={{
          flexShrink: 0,
          padding: '6px 10px',
          backgroundColor: 'transparent',
          color: '#B42318',
          border: '1px solid transparent',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#FEE2E2'
          e.currentTarget.style.borderColor = '#FCA5A5'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
        }}
      >
        Remover
      </button>
    </li>
  )
}
