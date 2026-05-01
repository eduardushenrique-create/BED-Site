'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

type OrderDetail = {
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  fulfillmentStatus: string
  total: number
  subtotal: number
  shippingCost: number
  customerName: string
  customerEmail: string
  trackingCode: string | null
  createdAt: string
  shippingAddress: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    observation?: string
  }>
  paymentDetails?: {
    status: string
    statusDetail?: string
    checkoutUrl?: string
    pixQrCodeBase64?: string
    pixCopyPaste?: string
  }
}

export default function MeuPedidoDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace(`/login?redirect=/meus-pedidos/${orderNumber}`)
    }
  }, [user, authLoading, router, orderNumber])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? 'Pedido não encontrado.' : 'Você não tem acesso a este pedido.')
          return
        }
        const data = await res.json()
        if (!cancelled) setOrder(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, orderNumber])

  if (authLoading || !user || loading) {
    return (
      <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', textAlign: 'center', color: '#6B7494' }}>
        Carregando...
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '720px', textAlign: 'center' }}>
        <h1 style={{ color: '#1D2235', fontSize: '28px', marginBottom: '16px' }}>{error || 'Pedido não encontrado.'}</h1>
        <Link href="/meus-pedidos" style={backBtnStyle}>Voltar para meus pedidos</Link>
      </main>
    )
  }

  const timeline = buildTimeline(order)

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '960px' }}>
      <Link href="/meus-pedidos" style={{ color: '#1D2235', fontWeight: 600, fontSize: '14px' }}>← Voltar para meus pedidos</Link>

      <header style={{ marginTop: '16px', marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Pedido</p>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: '#1D2235', margin: '6px 0 4px', fontFamily: 'var(--font-mono)' }}>{order.orderNumber}</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>Realizado em {formatDate(order.createdAt)}</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: '24px' }}>
        <div style={{ display: 'grid', gap: '24px' }}>
          <Section title="Acompanhamento">
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '14px' }}>
              {timeline.map((step, idx) => (
                <li key={idx} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: step.done ? '#1D7A72' : '#D8DCE8',
                    flexShrink: 0,
                    marginTop: '2px',
                  }} />
                  <div>
                    <strong style={{ color: step.done ? '#1D2235' : '#6B7494' }}>{step.label}</strong>
                    {step.detail && <div style={{ fontSize: '13px', color: '#6B7494' }}>{step.detail}</div>}
                  </div>
                </li>
              ))}
            </ol>
            {order.trackingCode && (
              <p style={{ marginTop: '16px', padding: '12px', background: '#F0F5FB', borderRadius: '8px', fontSize: '14px' }}>
                <strong>Código de rastreio:</strong> {order.trackingCode}
              </p>
            )}
          </Section>

          <Section title="Itens do pedido">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {order.items.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #EEF1F8' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1D2235' }}>{item.productName}</div>
                    <div style={{ fontSize: '13px', color: '#6B7494' }}>{item.quantity}x · R$ {item.unitPrice.toFixed(2).replace('.', ',')}</div>
                  </div>
                  <strong>R$ {(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}</strong>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Endereço de entrega">
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              {order.shippingAddress.street}, {order.shippingAddress.number}
              {order.shippingAddress.complement ? ` — ${order.shippingAddress.complement}` : ''}<br />
              {order.shippingAddress.neighborhood}<br />
              {order.shippingAddress.city} - {order.shippingAddress.state}<br />
              CEP {order.shippingAddress.zipCode}
            </p>
          </Section>
        </div>

        <aside style={{ display: 'grid', gap: '16px' }}>
          <Section title="Resumo">
            <Row label="Subtotal" value={`R$ ${order.subtotal.toFixed(2).replace('.', ',')}`} />
            <Row label="Frete" value={`R$ ${order.shippingCost.toFixed(2).replace('.', ',')}`} />
            <Row label="Total" value={`R$ ${order.total.toFixed(2).replace('.', ',')}`} bold />
          </Section>

          {order.paymentMethod === 'pix' && order.paymentDetails?.pixCopyPaste && order.paymentStatus !== 'paid' && (
            <Section title="Pague com Pix">
              {order.paymentDetails.pixQrCodeBase64 && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`data:image/png;base64,${order.paymentDetails.pixQrCodeBase64}`}
                  alt="QR Code Pix"
                  style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto 12px' }}
                />
              )}
              <textarea
                readOnly
                value={order.paymentDetails.pixCopyPaste}
                style={{ width: '100%', minHeight: '90px', padding: '10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #BBCFEB' }}
              />
            </Section>
          )}

          {order.paymentMethod === 'card' && order.paymentDetails?.checkoutUrl && order.paymentStatus !== 'paid' && (
            <Section title="Pagamento pendente">
              <a
                href={order.paymentDetails.checkoutUrl}
                style={{ display: 'block', textAlign: 'center', padding: '12px', background: '#1D2235', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}
              >
                Concluir pagamento
              </a>
            </Section>
          )}
        </aside>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1D2235', margin: '0 0 14px' }}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid #EEF1F8' : 'none', marginTop: bold ? '6px' : 0 }}>
      <span style={{ color: bold ? '#1D2235' : '#6B7494' }}>{label}</span>
      <span style={{ color: '#1D2235' }}>{value}</span>
    </div>
  )
}

function buildTimeline(order: OrderDetail) {
  const paid = order.paymentStatus === 'paid' || order.status === 'paid'
  const cancelled = order.status === 'cancelled'
  const refunded = order.status === 'refunded' || order.paymentStatus === 'refunded'
  const inProduction = order.fulfillmentStatus === 'in_production' || order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered'
  const shipped = order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered'
  const delivered = order.fulfillmentStatus === 'delivered'

  if (cancelled) return [{ label: 'Pedido cancelado', detail: undefined, done: true }]
  if (refunded) return [{ label: 'Pedido reembolsado', detail: undefined, done: true }]

  return [
    { label: 'Pedido recebido', detail: formatDate(order.createdAt), done: true },
    { label: 'Pagamento confirmado', detail: paid ? undefined : 'Aguardando confirmação', done: paid },
    { label: 'Em produção', detail: inProduction ? undefined : 'Inicia após pagamento', done: inProduction },
    { label: 'Enviado', detail: shipped ? (order.trackingCode || undefined) : undefined, done: shipped },
    { label: 'Entregue', detail: undefined, done: delivered },
  ]
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

const backBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '8px',
  padding: '12px 24px',
  background: '#1D2235',
  color: 'white',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 600,
}
