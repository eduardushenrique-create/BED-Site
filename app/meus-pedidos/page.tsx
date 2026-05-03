'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

type OrderSummary = {
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  fulfillmentStatus: string
  total: number
  itemCount: number
  trackingCode: string | null
  createdAt: string
}

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'pending_payment', label: 'Aguardando pagamento' },
  { value: 'paid', label: 'Pagos' },
  { value: 'cancelled', label: 'Cancelados' },
  { value: 'refunded', label: 'Reembolsados' },
]

export default function MeusPedidosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?redirect=/meus-pedidos')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      try {
        const res = await fetch(`/api/me/orders?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) {
            setOrders([])
            setTotal(0)
          }
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setOrders(Array.isArray(data.orders) ? data.orders : [])
          setTotal(data.total || 0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, statusFilter])

  if (authLoading || !user) {
    return (
      <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', textAlign: 'center', color: '#6B7494' }}>
        Carregando...
      </main>
    )
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '1240px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Minha conta</p>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: '#1D2235', margin: '8px 0 0' }}>Meus pedidos</h1>
          <p style={{ color: '#6B7494', marginTop: '6px' }}>{total} {total === 1 ? 'pedido' : 'pedidos'}</p>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1D2235' }}>
          Filtrar:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#1D2235' }}
          >
            {STATUS_FILTERS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p style={{ color: '#6B7494', textAlign: 'center', padding: '48px 0' }}>Carregando pedidos...</p>
      ) : orders.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '16px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '17px', color: '#1D2235', marginBottom: '12px' }}>
            {statusFilter ? 'Nenhum pedido com este status.' : 'Você ainda não tem pedidos.'}
          </p>
          <Link href="/produtos" style={{ display: 'inline-block', marginTop: '8px', padding: '12px 24px', background: '#1D2235', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>
            Ver produtos
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
          {orders.map(order => (
            <li key={order.orderNumber}>
              <Link
                href={`/meus-pedidos/${encodeURIComponent(order.orderNumber)}`}
                style={{
                  display: 'block',
                  padding: '20px',
                  background: 'white',
                  borderRadius: '14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  textDecoration: 'none',
                  color: '#1D2235',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#6B7494' }}>{order.orderNumber}</div>
                    <div style={{ marginTop: '4px', fontSize: '13px', color: '#6B7494' }}>
                      {formatDate(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <StatusBadge status={order.status} paymentStatus={order.paymentStatus} />
                    <strong style={{ fontSize: '17px' }}>R$ {order.total.toFixed(2).replace('.', ',')}</strong>
                  </div>
                </div>
                {order.trackingCode && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#1D7A72' }}>
                    Rastreio: <strong>{order.trackingCode}</strong>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function StatusBadge({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const map = resolveStatusBadge(status, paymentStatus)
  return (
    <span style={{
      padding: '4px 12px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 700,
      background: map.bg,
      color: map.color,
    }}>
      {map.label}
    </span>
  )
}

function resolveStatusBadge(status: string, paymentStatus: string) {
  if (status === 'paid' || paymentStatus === 'paid') return { label: 'Pago', bg: '#DFF4EC', color: '#1D7A72' }
  if (status === 'cancelled') return { label: 'Cancelado', bg: '#F1E5E9', color: '#A3526A' }
  if (status === 'refunded' || paymentStatus === 'refunded') return { label: 'Reembolsado', bg: '#E5E5F4', color: '#4A4F8A' }
  if (paymentStatus === 'rejected') return { label: 'Pagamento recusado', bg: '#F1E5E9', color: '#A3526A' }
  return { label: 'Aguardando pagamento', bg: '#FCEBD9', color: '#A36A1F' }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}
