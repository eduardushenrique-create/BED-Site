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

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 my-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Pagamentos</h3>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Registrar pagamento
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded bg-zinc-800/50 p-3">
          <div className="text-xs text-zinc-400">Total do pedido</div>
          <div className="text-lg font-semibold">{formatBRL(totals.total)}</div>
        </div>
        <div className="rounded bg-zinc-800/50 p-3">
          <div className="text-xs text-zinc-400">Pago</div>
          <div className={`text-lg font-semibold ${isFullyPaid ? 'text-emerald-400' : isPartial ? 'text-amber-400' : ''}`}>
            {formatBRL(totals.paidAmount)}
          </div>
        </div>
        <div className="rounded bg-zinc-800/50 p-3">
          <div className="text-xs text-zinc-400">Saldo a receber</div>
          <div className={`text-lg font-semibold ${totals.dueAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {formatBRL(totals.dueAmount)}
          </div>
        </div>
      </div>

      {refundStatus === 'manual_required' && (
        <div className="mb-3 rounded border border-amber-700 bg-amber-900/30 p-3 text-sm text-amber-200">
          <strong>Reembolso pendente:</strong> este pedido teve itens cancelados
          após o pagamento. Verifique o saldo a estornar manualmente.
        </div>
      )}

      {loading && <div className="text-sm text-zinc-400">Carregando…</div>}
      {error && <div className="text-sm text-red-400">{error}</div>}

      {!loading && installments.length === 0 && (
        <div className="text-sm text-zinc-500 italic">
          Nenhum pagamento registrado.
        </div>
      )}

      {installments.length > 0 && (
        <div className="space-y-2">
          {installments.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/30 p-3"
            >
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-zinc-500 text-xs">#{i.sequence}</span>
                  <span className="font-medium">
                    {i.isRefund ? '−' : '+'}
                    {formatBRL(i.amount)}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ({METHOD_LABELS[i.method] || i.method})
                  </span>
                  {i.isRefund && (
                    <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-xs text-red-300">
                      estorno
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {formatDate(i.receivedAt)} · por {i.receivedByEmail}
                  {i.description && ` · ${i.description}`}
                </div>
                {i.notes && (
                  <div className="text-xs text-zinc-600 mt-0.5 italic">
                    {i.notes}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(i.id)}
                className="text-xs text-red-400 hover:text-red-300 ml-2"
                title="Remover (com motivo)"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
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
