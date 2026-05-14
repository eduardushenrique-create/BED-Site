'use client'

import { useState } from 'react'

/**
 * SPEC-005 §3.1.3 — Modal de exclusão de tarefa de produção em 3 modos.
 *
 * Modo ORDER tem step-up de UI (R20 do ADR-003 v2): exige digitar o
 * número do pedido para habilitar o botão "Confirmar". Não substitui
 * autenticação real (TOTP) — é defesa em profundidade.
 */

type Mode = 'TASK_ONLY' | 'ITEM_ONLY' | 'ORDER'

interface Props {
  productionTaskId: string
  orderNumber: string
  itemName: string
  onClose: () => void
  onSuccess: (result: { refundDue?: number }) => void
}

const MODES: Array<{ value: Mode; title: string; desc: string }> = [
  {
    value: 'TASK_ONLY',
    title: 'Só tirar da fila de produção',
    desc:
      'Mantém o item no pedido. Use se a tarefa foi criada por engano ou será produzida em outro lugar.',
  },
  {
    value: 'ITEM_ONLY',
    title: 'Cancelar este item do pedido',
    desc:
      'Remove o item, recalcula o total. Pedido continua aberto com os outros itens. Se já houve pagamento maior que o novo total, o saldo a estornar fica marcado pra você devolver manualmente.',
  },
  {
    value: 'ORDER',
    title: 'Cancelar o pedido inteiro',
    desc:
      'Cancela TODOS os itens e tarefas, marca o pedido como cancelado. Se houve pagamento, saldo a estornar fica marcado.',
  },
]

export default function DeleteProductionTaskModal({
  productionTaskId,
  orderNumber,
  itemName,
  onClose,
  onSuccess,
}: Props) {
  const [mode, setMode] = useState<Mode>('TASK_ONLY')
  const [reason, setReason] = useState('')
  const [orderConfirm, setOrderConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundFromServer, setRefundFromServer] = useState<number | null>(null)

  const reasonOk = reason.trim().length >= 5
  const orderConfirmOk = mode !== 'ORDER' || orderConfirm.trim() === orderNumber.trim()

  const handleSubmit = async () => {
    if (!reasonOk || !orderConfirmOk) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/producao/${productionTaskId}?mode=${mode}&reason=${encodeURIComponent(reason)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (typeof data.refundDue === 'number' && data.refundDue > 0) {
        setRefundFromServer(data.refundDue)
        // Aguarda 2s mostrando o aviso antes de fechar
        setTimeout(() => onSuccess({ refundDue: data.refundDue }), 2500)
        return
      }
      onSuccess({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao cancelar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold mb-1">Excluir tarefa de produção</h2>
        <p className="text-sm text-zinc-400 mb-4">
          {itemName} · Pedido <span className="font-mono">{orderNumber}</span>
        </p>

        <div className="space-y-2 mb-4">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`block cursor-pointer rounded border p-3 ${
                mode === m.value
                  ? 'border-emerald-600 bg-emerald-900/20'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="cancel-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{m.title}</div>
                  <div className="text-xs text-zinc-400 mt-1">{m.desc}</div>
                </div>
              </div>
            </label>
          ))}
        </div>

        {refundFromServer !== null && refundFromServer > 0 && (
          <div className="mb-3 rounded border border-amber-700 bg-amber-900/30 p-3 text-sm text-amber-200">
            ⚠ <strong>Saldo a estornar manualmente:</strong> R$ {refundFromServer.toFixed(2)}
            <br />
            Marcado em refundStatus do pedido. Estorne pelo painel do meio de pagamento.
          </div>
        )}

        <div className="mb-3">
          <label className="block text-sm text-zinc-300 mb-1">
            Motivo (obrigatório, mín 5 caracteres)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            placeholder="Ex: cliente desistiu, item duplicado, etc."
          />
        </div>

        {mode === 'ORDER' && (
          <div className="mb-3">
            <label className="block text-sm text-amber-300 mb-1">
              Para confirmar, digite o número do pedido:{' '}
              <span className="font-mono">{orderNumber}</span>
            </label>
            <input
              type="text"
              value={orderConfirm}
              onChange={(e) => setOrderConfirm(e.target.value)}
              placeholder={orderNumber}
              className="w-full rounded border border-amber-700 bg-zinc-800 px-3 py-2 text-sm font-mono"
            />
          </div>
        )}

        {error && (
          <div className="rounded bg-red-900/30 border border-red-700 p-2 text-sm text-red-300 mb-3">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !reasonOk || !orderConfirmOk}
            className={`rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              mode === 'ORDER'
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {submitting ? 'Cancelando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
