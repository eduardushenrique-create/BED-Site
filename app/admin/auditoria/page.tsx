'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type AuditItem = {
  id: string
  actorEmail: string
  actorRole: string | null
  action: string
  targetType: string
  targetId: string | null
  summary: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

const KNOWN_ACTIONS = ['order.update', 'order.delete', 'order.refund', 'coupon.create', 'coupon.update', 'coupon.delete', 'customer.delete']
const KNOWN_TARGETS = ['Order', 'Coupon', 'Customer', 'Product']

export default function AuditoriaPage() {
  const [items, setItems] = useState<AuditItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const params = useMemo(() => {
    const sp = new URLSearchParams()
    if (actor) sp.set('actor', actor)
    if (action) sp.set('action', action)
    if (targetType) sp.set('targetType', targetType)
    sp.set('limit', String(limit))
    sp.set('offset', String(offset))
    return sp.toString()
  }, [actor, action, targetType, offset])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/audit-log?${params}`, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) { setItems([]); setTotal(0) }
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setItems(data.items || [])
          setTotal(data.total || 0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [params])

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin" style={{ color: '#6B7494', textDecoration: 'none' }}>← Voltar ao painel</Link>
      </div>

      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Auditoria</h1>
        <p style={{ color: '#6B7494', margin: '4px 0 0' }}>
          Registro de ações sensíveis (estornos, alterações de pedidos/cupons, exclusões).
        </p>
      </header>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={actor}
          onChange={e => { setActor(e.target.value); setOffset(0) }}
          placeholder="Filtrar por e-mail do ator"
          style={{ flex: 1, minWidth: '220px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8' }}
        />
        <select
          value={action}
          onChange={e => { setAction(e.target.value); setOffset(0) }}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8' }}
        >
          <option value="">Todas as ações</option>
          {KNOWN_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={targetType}
          onChange={e => { setTargetType(e.target.value); setOffset(0) }}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8' }}
        >
          <option value="">Qualquer tipo</option>
          {KNOWN_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <p style={{ color: '#6B7494', fontSize: '13px', marginBottom: '12px' }}>
        {loading ? 'Carregando...' : `${items.length} de ${total} registro(s)`}
      </p>

      <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
          <thead>
            <tr style={{ background: '#F0F5FB', textAlign: 'left', fontSize: '13px', color: '#6B7494' }}>
              <th style={th}>Quando</th>
              <th style={th}>Ator</th>
              <th style={th}>Ação</th>
              <th style={th}>Alvo</th>
              <th style={th}>Resumo</th>
              <th style={th}>IP</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6B7494' }}>Sem registros para os filtros atuais.</td></tr>
            ) : (
              items.map(item => (
                <tr key={item.id} style={{ borderTop: '1px solid #EEF1F8' }}>
                  <td style={td}>
                    <div style={{ fontSize: '13px' }}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</div>
                    <div style={{ fontSize: '12px', color: '#6B7494' }}>{new Date(item.createdAt).toLocaleTimeString('pt-BR')}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.actorEmail}</div>
                    {item.actorRole && <div style={{ fontSize: '11px', color: '#6B7494' }}>{item.actorRole}</div>}
                  </td>
                  <td style={td}>
                    <code style={{ fontSize: '12px', background: '#F0F5FB', padding: '2px 6px', borderRadius: '4px' }}>{item.action}</code>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: '13px' }}>{item.targetType}</div>
                    {item.targetId && <div style={{ fontSize: '11px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>{item.targetId}</div>}
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: '13px', color: '#1D2235' }}>{item.summary || '—'}</div>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: '12px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>{item.ip || '—'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button
          onClick={() => setOffset(prev => Math.max(0, prev - limit))}
          disabled={offset === 0 || loading}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: offset === 0 ? 'not-allowed' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}
        >
          ← Anteriores
        </button>
        <span style={{ fontSize: '13px', color: '#6B7494' }}>{offset + 1} – {Math.min(offset + limit, total)} de {total}</span>
        <button
          onClick={() => setOffset(prev => prev + limit)}
          disabled={offset + limit >= total || loading}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: offset + limit >= total ? 'not-allowed' : 'pointer', opacity: offset + limit >= total ? 0.5 : 1 }}
        >
          Próximos →
        </button>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 16px', fontWeight: 600 }
const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'top' }
