'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Review = {
  id: string
  productId: string
  customerName: string
  customerEmail: string
  rating: number
  title: string | null
  body: string | null
  status: 'pending' | 'approved' | 'hidden'
  orderNumber: string | null
  moderatedAt: string | null
  moderatedBy: string | null
  createdAt: string
}

const STATUSES = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'hidden', label: 'Ocultas' },
]

export default function AvaliacoesAdminPage() {
  const [items, setItems] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [offset, setOffset] = useState(0)
  const limit = 50
  const [actingId, setActingId] = useState<string | null>(null)

  const params = useMemo(() => {
    const sp = new URLSearchParams()
    if (statusFilter) sp.set('status', statusFilter)
    sp.set('limit', String(limit))
    sp.set('offset', String(offset))
    return sp.toString()
  }, [statusFilter, offset])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/avaliacoes?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        setItems([]); setTotal(0); return
      }
      const data = await res.json()
      setItems(data.items || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [params])

  async function handleAction(id: string, action: 'approve' | 'hide' | 'delete') {
    setActingId(id)
    try {
      if (action === 'delete') {
        const res = await fetch(`/api/avaliacoes/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          alert('Erro ao excluir.')
          return
        }
      } else {
        const status = action === 'approve' ? 'approved' : 'hidden'
        const res = await fetch(`/api/avaliacoes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        if (!res.ok) {
          alert('Erro ao moderar.')
          return
        }
      }
      await load()
    } finally {
      setActingId(null)
    }
  }

  function statusLabel(status: string) {
    if (status === 'pending') return { label: 'Pendente', color: '#F59E0B' }
    if (status === 'approved') return { label: 'Aprovada', color: '#10B981' }
    return { label: 'Oculta', color: '#6B7494' }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin" style={{ color: '#6B7494', textDecoration: 'none' }}>← Voltar ao painel</Link>
      </div>

      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Avaliações</h1>
        <p style={{ color: '#6B7494', margin: '4px 0 0' }}>
          Modere as avaliações dos clientes. Apenas avaliações aprovadas aparecem na vitrine.
        </p>
      </header>

      <div style={{ marginBottom: '20px' }}>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setOffset(0) }}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8' }}
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <p style={{ color: '#6B7494', fontSize: '13px', marginBottom: '12px' }}>
        {loading ? 'Carregando...' : `${items.length} de ${total} avaliação(ões)`}
      </p>

      <div style={{ display: 'grid', gap: '12px' }}>
        {items.length === 0 && !loading && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#6B7494' }}>
            Sem avaliações para os filtros atuais.
          </div>
        )}

        {items.map(review => {
          const info = statusLabel(review.status)
          return (
            <article key={review.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '20px', letterSpacing: '2px' }}>
                    {'★'.repeat(review.rating)}<span style={{ color: '#D8DCE8' }}>{'★'.repeat(5 - review.rating)}</span>
                  </div>
                  {review.title && <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '8px 0 4px' }}>{review.title}</h2>}
                  <p style={{ fontSize: '13px', color: '#6B7494', margin: 0 }}>
                    {review.customerName} · {review.customerEmail}
                    {review.orderNumber && <> · pedido <code style={{ fontFamily: 'var(--font-mono)' }}>{review.orderNumber}</code></>}
                  </p>
                  <p style={{ fontSize: '12px', color: '#6B7494', margin: '4px 0 0' }}>
                    {new Date(review.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: `${info.color}20`, color: info.color }}>
                  {info.label}
                </span>
              </div>

              {review.body && (
                <p style={{ marginTop: '16px', color: '#1D2235', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{review.body}</p>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {review.status !== 'approved' && (
                  <button
                    onClick={() => handleAction(review.id, 'approve')}
                    disabled={actingId === review.id}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#10B981', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Aprovar
                  </button>
                )}
                {review.status !== 'hidden' && (
                  <button
                    onClick={() => handleAction(review.id, 'hide')}
                    disabled={actingId === review.id}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#1D2235', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Ocultar
                  </button>
                )}
                <button
                  onClick={() => { if (confirm('Excluir avaliação? Esta ação não pode ser desfeita.')) handleAction(review.id, 'delete') }}
                  disabled={actingId === review.id}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #EF4444', background: 'white', color: '#B42318', fontWeight: 600, cursor: 'pointer' }}
                >
                  Excluir
                </button>
                <Link
                  href={`/produtos/${encodeURIComponent(review.productId)}`}
                  style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#4A7AB5', fontWeight: 600, textDecoration: 'none', fontSize: '13px' }}
                >
                  Ver produto
                </Link>
              </div>
            </article>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <button
          onClick={() => setOffset(prev => Math.max(0, prev - limit))}
          disabled={offset === 0 || loading}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: offset === 0 ? 'not-allowed' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}
        >
          ← Anteriores
        </button>
        <span style={{ fontSize: '13px', color: '#6B7494' }}>{total === 0 ? '0' : `${offset + 1} – ${Math.min(offset + limit, total)} de ${total}`}</span>
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
