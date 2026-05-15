'use client'

/**
 * SPEC-007 §3.1.3 — modal "Converter em pedido".
 *
 * Coleta manualChannel, referredBy e initialInstallment (opcional).
 * Chama POST /api/orcamentos/[id]/converter-pedido (endpoint do PR-2b).
 * O endpoint ainda não está mergeado, mas a chamada é feita da mesma forma
 * quando os PRs convergirem.
 */

import { useEffect, useState } from 'react'

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'outro', label: 'Outro' },
] as const

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix_manual', label: 'PIX (manual)' },
  { value: 'bank_transfer', label: 'Transferência bancária' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'other', label: 'Outro' },
] as const

type Estimate = {
  id: string
  name: string
  customerName: string | null
  finalPrice: number | null
  suggestedPrice: number
  costTotal: number
}

type Props = {
  estimate: Estimate
  onClose: () => void
  onConverted: (orderId: string, orderNumber: string) => void
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(29,34,53,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
}

const MODAL: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '28px',
  maxWidth: '520px',
  width: '100%',
  maxHeight: 'calc(100vh - 32px)',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1D2235',
  marginBottom: '6px',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  backgroundColor: 'white',
  color: '#1D2235',
}

export default function ConvertToOrderModal({ estimate, onClose, onConverted }: Props) {
  const [channel, setChannel] = useState<string>('whatsapp')
  const [referredBy, setReferredBy] = useState('')
  const [withInstallment, setWithInstallment] = useState(false)
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentMethod, setInstallmentMethod] = useState('pix_manual')
  const [installmentNotes, setInstallmentNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayPrice = estimate.finalPrice ?? estimate.suggestedPrice

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const body: Record<string, unknown> = {
      manualChannel: channel,
      referredBy: referredBy.trim() || undefined,
    }

    if (withInstallment) {
      const amt = Number(installmentAmount)
      if (!Number.isFinite(amt) || amt <= 0) {
        setError('Valor da entrada deve ser maior que zero.')
        setSubmitting(false)
        return
      }
      body.initialInstallment = {
        amount: amt,
        method: installmentMethod,
        notes: installmentNotes.trim() || undefined,
        receivedAt: new Date().toISOString(),
      }
      body.paymentStatus = 'partial'
    }

    try {
      const res = await fetch(`/api/orcamentos/${estimate.id}/converter-pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      onConverted(data.orderId, data.orderNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao converter orçamento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-modal-title"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
      style={OVERLAY}
    >
      <form
        onSubmit={handleSubmit}
        onMouseDown={e => e.stopPropagation()}
        style={MODAL}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            gap: '12px',
          }}
        >
          <div>
            <h2
              id="convert-modal-title"
              style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: '#1D2235' }}
            >
              Converter em pedido
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7494', margin: '4px 0 0' }}>
              {estimate.name}
              {estimate.customerName ? ` — ${estimate.customerName}` : ''}
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

        {/* Resumo do orçamento */}
        <div
          style={{
            backgroundColor: '#F0F5FB',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: '#6B7494' }}>Valor do pedido</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '18px',
              color: '#0E9F6E',
            }}
          >
            {displayPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Canal */}
          <div>
            <label htmlFor="convert-channel" style={LABEL_STYLE}>
              Canal de origem *
            </label>
            <select
              id="convert-channel"
              value={channel}
              onChange={e => setChannel(e.target.value)}
              required
              style={INPUT_STYLE}
            >
              {CHANNELS.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Indicação */}
          {channel === 'indicacao' && (
            <div>
              <label htmlFor="convert-referred-by" style={LABEL_STYLE}>
                Quem indicou
              </label>
              <input
                id="convert-referred-by"
                type="text"
                value={referredBy}
                onChange={e => setReferredBy(e.target.value)}
                placeholder="Nome de quem indicou o cliente"
                style={INPUT_STYLE}
              />
            </div>
          )}

          {/* Entrada */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #EEF1F8',
              backgroundColor: withInstallment ? '#DFF4EC' : '#FAFBFD',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={withInstallment}
              onChange={e => setWithInstallment(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#0E9F6E', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: withInstallment ? '#0E9F6E' : '#1D2235' }}>
              Registrar entrada agora
            </span>
          </label>

          {withInstallment && (
            <div
              style={{
                padding: '14px',
                backgroundColor: '#FAFBFD',
                borderRadius: '10px',
                border: '1px solid #EEF1F8',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                }}
              >
                <div>
                  <label htmlFor="convert-amount" style={LABEL_STYLE}>
                    Valor da entrada (R$)
                  </label>
                  <input
                    id="convert-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={installmentAmount}
                    onChange={e => setInstallmentAmount(e.target.value)}
                    placeholder={displayPrice.toFixed(2)}
                    style={{ ...INPUT_STYLE, fontFamily: 'var(--font-mono)' }}
                    required={withInstallment}
                  />
                </div>
                <div>
                  <label htmlFor="convert-method" style={LABEL_STYLE}>
                    Método
                  </label>
                  <select
                    id="convert-method"
                    value={installmentMethod}
                    onChange={e => setInstallmentMethod(e.target.value)}
                    style={INPUT_STYLE}
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="convert-notes" style={LABEL_STYLE}>
                  Observações (opcional)
                </label>
                <input
                  id="convert-notes"
                  type="text"
                  value={installmentNotes}
                  onChange={e => setInstallmentNotes(e.target.value)}
                  placeholder="Ex: Entrada PIX"
                  style={INPUT_STYLE}
                />
              </div>
            </div>
          )}

          {/* Erro */}
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

        {/* Ações */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '24px',
          }}
        >
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
            disabled={submitting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0E9F6E',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Convertendo…' : 'Criar pedido →'}
          </button>
        </div>
      </form>
    </div>
  )
}
