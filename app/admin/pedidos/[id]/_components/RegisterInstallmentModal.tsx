'use client'

import { useState } from 'react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Registrar pagamento</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-zinc-300 mb-1">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
            {dueAmountSuggestion > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                Saldo atual: R$ {dueAmountSuggestion.toFixed(2)}
              </p>
            )}
            {overflow && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠ Valor maior que o saldo devido (margem 20%)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">Método</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">
              Recebido em
            </label>
            <input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              required
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Ex: Entrada PIX para conta XPTO"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500 mt-1">
              ⚠ Não incluir CPF/RG/dados sensíveis
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">
              Notas internas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={isRefund}
              onChange={(e) => setIsRefund(e.target.checked)}
            />
            Marcar como estorno (saldo a devolver)
          </label>

          {error && (
            <div className="rounded bg-red-900/30 border border-red-700 p-2 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !amountValid}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
