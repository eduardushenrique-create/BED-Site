'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  id: string
  status: 'pending' | 'paid' | 'canceled' | 'overdue'
  isArchived: boolean
  onActionDone?: () => void
}

export function ExpenseActionsMenu({ id, status, isArchived, onActionDone }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function callAction(action: string) {
    setBusy(action)
    setError('')
    try {
      const res = await fetch(`/api/despesas/${id}/${action}`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || `Erro ao executar acao: ${action}`)
        return
      }
      if (onActionDone) {
        onActionDone()
      } else {
        router.refresh()
      }
    } catch {
      setError('Erro de conexao.')
    } finally {
      setBusy(null)
    }
  }

  const canMarkPaid = status !== 'paid' && status !== 'canceled'
  const canCancel = status !== 'canceled'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link
          href={`/admin/despesas/${id}`}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', fontSize: '13px', fontWeight: 600, textDecoration: 'none', color: '#1D2235', cursor: 'pointer', display: 'inline-block' }}
        >
          Editar
        </Link>

        <button
          type="button"
          onClick={() => callAction('marcar-paga')}
          disabled={!canMarkPaid || busy !== null}
          title={!canMarkPaid ? 'Despesa ja paga ou cancelada' : undefined}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: canMarkPaid && busy === null ? '#1D7A72' : '#E3E9F4',
            color: canMarkPaid && busy === null ? 'white' : '#9AA1B8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: canMarkPaid && busy === null ? 'pointer' : 'not-allowed',
          }}
        >
          {busy === 'marcar-paga' ? 'Salvando...' : 'Marcar como paga'}
        </button>

        <button
          type="button"
          onClick={() => callAction('cancelar')}
          disabled={!canCancel || busy !== null}
          title={!canCancel ? 'Despesa ja cancelada' : undefined}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #FCA5A5',
            background: 'white',
            color: canCancel && busy === null ? '#B42318' : '#9AA1B8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: canCancel && busy === null ? 'pointer' : 'not-allowed',
          }}
        >
          {busy === 'cancelar' ? 'Cancelando...' : 'Cancelar'}
        </button>

        {isArchived ? (
          <button
            type="button"
            onClick={() => callAction('restaurar')}
            disabled={busy !== null}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#4A7AB5', fontSize: '13px', fontWeight: 600, cursor: busy !== null ? 'not-allowed' : 'pointer' }}
          >
            {busy === 'restaurar' ? 'Restaurando...' : 'Restaurar'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => callAction('arquivar')}
            disabled={busy !== null}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#6B7494', fontSize: '13px', fontWeight: 600, cursor: busy !== null ? 'not-allowed' : 'pointer' }}
          >
            {busy === 'arquivar' ? 'Arquivando...' : 'Arquivar'}
          </button>
        )}
      </div>
    </div>
  )
}
