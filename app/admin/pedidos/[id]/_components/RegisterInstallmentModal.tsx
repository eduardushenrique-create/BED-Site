'use client'

import { useEffect, useState } from 'react'

/**
 * SPEC-005 §3.2.4 — Modal de registro de pagamento.
 *
 * R17 do ADR-003 v2 (amount tampering): client-side valida amount em
 * (0, 100k] e mostra alerta se ultrapassa o saldo devido. Server-side
 * tem CHECK constraint + Zod-like validation duplicados.
 */

const METHODS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix_manual', label: 'PIX (manual)' },
  { value: 'bank_transfer', label: 'Transferência bancária' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'other', label: 'Outro' },
] as const

interface Props {
  orderId: string
  dueAmountSuggestion: number
  onClose: () => void
  onCreated: (result: { totals: { total: number; paidAmount: number; dueAmount: number } }) => void
}

// Tokens visuais alinhados ao restante do admin
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  backgroundColor: 'white',
  color: '#1D2235',
  fontFamily: 'var(--font-body)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1D2235',
  marginBottom: '6px',
}

const helperStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6B7494',
  marginTop: '4px',
}

export default function RegisterInstallmentModal({
  orderId,
  dueAmountSuggestion,
  onClose,
  onCreated,
}: Props) {
  const [amount, setAmount] = useState(dueAmountSuggestion.toFixed(2))
  const [method, setMethod] = useState('cash')
  const [description, setDescription] = useState('')
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [notes, setNotes] = useState('')
  const [isRefund, setIsRefund] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountNum = Number(amount)
  const amountValid =
    Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000
  const overflow =
    amountValid && !isRefund && amountNum > dueAmountSuggestion * 1.2 && dueAmountSuggestion > 0

  // Fecha com Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountValid) {
      setError('Valor deve estar entre R$ 0,01 e R$ 100.000,00')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/pedidos/${orderId}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          method,
          description: description || null,
          receivedAt: new Date(receivedAt + 'T12:00:00').toISOString(),
          notes: notes || null,
          isRefund,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onCreated(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-installment-title"
      onMouseDown={(e) => {
        // Fecha somente se o mousedown começou no overlay (evita fechar
        // ao soltar o mouse arrastando texto de dentro do form)
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(29, 34, 53, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '480px',
          width: '100%',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '12px' }}>
          <div>
            <h2 id="register-installment-title" style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
              Registrar pagamento
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7494', margin: '4px 0 0' }}>
              Lance uma parcela recebida ou um estorno deste pedido.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            disabled={submitting}
            style={{
              flexShrink: 0,
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#F0F5FB',
              color: '#6B7494',
              fontSize: '18px',
              lineHeight: 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Valor */}
          <div>
            <label htmlFor="installment-amount" style={labelStyle}>Valor (R$)</label>
            <input
              id="installment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 600 }}
            />
            {dueAmountSuggestion > 0 && (
              <p style={helperStyle}>
                Saldo atual: <span style={{ fontFamily: 'var(--font-mono)' }}>R$ {dueAmountSuggestion.toFixed(2).replace('.', ',')}</span>
              </p>
            )}
            {overflow && (
              <p
                style={{
                  marginTop: '8px',
                  borderRadius: '8px',
                  border: '1px solid #F59E0B',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Valor maior que o saldo devido (acima de 20% de margem).
              </p>
            )}
          </div>

          {/* Método + Data — duas colunas se couber */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label htmlFor="installment-method" style={labelStyle}>Método</label>
              <select
                id="installment-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={inputStyle}
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="installment-received-at" style={labelStyle}>Recebido em</label>
              <input
                id="installment-received-at"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="installment-description" style={labelStyle}>Descrição (opcional)</label>
            <input
              id="installment-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Ex: Entrada PIX para conta XPTO"
              style={inputStyle}
            />
            <p style={helperStyle}>
              Não incluir CPF/RG ou dados sensíveis.
            </p>
          </div>

          {/* Notas */}
          <div>
            <label htmlFor="installment-notes" style={labelStyle}>Notas internas (opcional)</label>
            <textarea
              id="installment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '72px', fontFamily: 'var(--font-body)' }}
            />
          </div>

          {/* Estorno */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #EEF1F8',
              backgroundColor: isRefund ? '#FEE2E2' : '#FAFBFD',
              cursor: 'pointer',
              transition: 'background-color 120ms ease',
            }}
          >
            <input
              type="checkbox"
              checked={isRefund}
              onChange={(e) => setIsRefund(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#B42318', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', color: isRefund ? '#B42318' : '#1D2235', fontWeight: 600 }}>
              Marcar como estorno
            </span>
            <span style={{ fontSize: '12px', color: '#6B7494' }}>
              (saldo a devolver, não recebido)
            </span>
          </label>

          {error && (
            <div
              role="alert"
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
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 18px',
              backgroundColor: 'white',
              color: '#1D2235',
              border: '1px solid #D8DCE8',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !amountValid}
            style={{
              padding: '10px 20px',
              backgroundColor: isRefund ? '#B42318' : '#0E9F6E',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: submitting || !amountValid ? 'not-allowed' : 'pointer',
              opacity: submitting || !amountValid ? 0.5 : 1,
            }}
          >
            {submitting ? 'Registrando…' : isRefund ? 'Registrar estorno' : 'Registrar pagamento'}
          </button>
        </div>
      </form>
    </div>
  )
}
