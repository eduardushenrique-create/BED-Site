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

type ProductionItem = {
  productName: string
  requiredQuantity: number
  producedQuantity: number
  remainingQuantity: number
  progressPercent: number
  status: string
  label: string
  updatedAt: string | null
}

type ProductionOverall = {
  requiredQuantity: number
  producedQuantity: number
  remainingQuantity: number
  progressPercent: number
  status: string
  label: string
}

type ProductionData = {
  orderNumber: string
  hasProduction: boolean
  overall: ProductionOverall | null
  items: ProductionItem[]
}

export default function MeuPedidoDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [production, setProduction] = useState<ProductionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

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
        const [res, prodRes] = await Promise.all([
          fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: 'no-store' }),
          fetch(`/api/me/orders/${encodeURIComponent(orderNumber)}/production`, { cache: 'no-store' }).catch(() => null),
        ])
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? 'Pedido não encontrado.' : 'Você não tem acesso a este pedido.')
          return
        }
        const data = await res.json()
        if (!cancelled) setOrder(data)

        if (prodRes && prodRes.ok) {
          try {
            const prodData = (await prodRes.json()) as ProductionData
            if (!cancelled && prodData && prodData.hasProduction) {
              setProduction(prodData)
            }
          } catch {
            // silencioso
          }
        }
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

  const timeline = buildTimeline(order, production)

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

          {production && production.hasProduction && (
            <Section title="📦 Produção do seu pedido">
              <p style={{ margin: '0 0 18px', color: '#6B7494', fontSize: '14px', lineHeight: 1.6 }}>
                Estamos produzindo os itens personalizados do seu pedido. O progresso abaixo é uma estimativa operacional e pode ser atualizado durante a produção.
              </p>

              {production.overall && (
                <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#F6F9FC', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <strong style={{ color: '#1D2235', fontSize: '14px' }}>Visão geral · {production.overall.label}</strong>
                    <span style={{ color: '#6B7494', fontSize: '13px' }}>
                      {production.overall.producedQuantity} de {production.overall.requiredQuantity} unidades produzidas ({production.overall.progressPercent}%)
                    </span>
                  </div>
                  <ProgressBar percent={production.overall.progressPercent} />
                </div>
              )}

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '14px' }}>
                {production.items.map((item, idx) => (
                  <li
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #EEF1F8',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#1D2235', marginBottom: '4px' }}>{item.productName}</div>
                    <div style={{ fontSize: '13px', color: '#6B7494', marginBottom: '8px' }}>
                      Status: {item.label} · {item.producedQuantity} de {item.requiredQuantity} unidades produzidas
                    </div>
                    <ProgressBar percent={item.progressPercent} />
                    {item.updatedAt && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B7494' }}>
                        Última atualização: {formatDate(item.updatedAt)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

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

          {order.paymentMethod === 'pix' && order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
            <Section title="Pague com Pix">
              {order.paymentDetails?.pixQrCodeBase64 && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`data:image/png;base64,${order.paymentDetails.pixQrCodeBase64}`}
                  alt="QR Code Pix"
                  style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto 12px' }}
                />
              )}
              {order.paymentDetails?.pixCopyPaste ? (
                <textarea
                  readOnly
                  value={order.paymentDetails.pixCopyPaste}
                  style={{ width: '100%', minHeight: '90px', padding: '10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #BBCFEB' }}
                />
              ) : (
                <p style={{ margin: '0 0 12px', color: '#6B7494', fontSize: '13px' }}>
                  Nenhum Pix ativo no momento. Gere um novo abaixo.
                </p>
              )}
              <RegeneratePixButton orderNumber={order.orderNumber} />
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

          {order.paymentStatus === 'pending' && order.status !== 'cancelled' && (
            <Section title="Mudou de ideia?">
              <p style={{ fontSize: '13px', color: '#6B7494', margin: '0 0 12px' }}>
                Enquanto o pagamento estiver pendente, você pode cancelar este pedido.
                Após o pagamento, fale com o suporte.
              </p>
              {!showCancelConfirm ? (
                <button
                  onClick={() => { setCancelError(''); setShowCancelConfirm(true) }}
                  style={{ display: 'block', width: '100%', padding: '10px', background: 'white', border: '1px solid #EF4444', borderRadius: '10px', cursor: 'pointer', color: '#EF4444', fontWeight: 600 }}
                >
                  Cancelar pedido
                </button>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: '#1D2235' }}>Confirma o cancelamento? Esta ação não pode ser desfeita.</p>
                  {cancelError && (
                    <p role="alert" style={{ margin: 0, color: '#B42318', fontSize: '13px' }}>{cancelError}</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      disabled={cancelling}
                      onClick={() => setShowCancelConfirm(false)}
                      style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #D8DCE8', borderRadius: '10px', cursor: cancelling ? 'not-allowed' : 'pointer' }}
                    >
                      Não, manter
                    </button>
                    <button
                      disabled={cancelling}
                      onClick={async () => {
                        setCancelling(true)
                        setCancelError('')
                        try {
                          const res = await fetch(`/api/me/orders/${encodeURIComponent(order.orderNumber)}/cancel`, { method: 'POST' })
                          const data = await res.json().catch(() => null)
                          if (!res.ok) {
                            setCancelError(data?.error || 'Não foi possível cancelar.')
                            return
                          }
                          // Reload to reflect new state
                          window.location.reload()
                        } catch {
                          setCancelError('Erro de conexão. Tente novamente.')
                        } finally {
                          setCancelling(false)
                        }
                      }}
                      style={{ flex: 1, padding: '10px', background: '#EF4444', border: 'none', borderRadius: '10px', cursor: cancelling ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 600, opacity: cancelling ? 0.7 : 1 }}
                    >
                      {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                    </button>
                  </div>
                </div>
              )}
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

function ProgressBar({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      style={{
        width: '100%',
        height: '8px',
        background: '#E4EDF8',
        borderRadius: '999px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${safe}%`,
          height: '100%',
          background: '#1D7A72',
          borderRadius: '999px',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
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

function buildTimeline(order: OrderDetail, production: ProductionData | null) {
  const paid = order.paymentStatus === 'paid' || order.status === 'paid'
  const cancelled = order.status === 'cancelled'
  const refunded = order.status === 'refunded' || order.paymentStatus === 'refunded'
  const fulfillmentInProduction = order.fulfillmentStatus === 'in_production' || order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered'
  const shipped = order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered'
  const delivered = order.fulfillmentStatus === 'delivered'

  const productionActive = !!(production && production.hasProduction && production.overall && production.overall.status !== 'completed')
  const productionCompleted = !!(production && production.hasProduction && production.overall && production.overall.status === 'completed')

  // Não regredir etapas: produção considerada "feita" quando webhook avançou OU quando produção operacional completou.
  const inProduction = fulfillmentInProduction || productionActive || productionCompleted
  const readyOrShipped = shipped || (productionCompleted && !shipped)

  if (cancelled) return [{ label: 'Pedido cancelado', detail: undefined, done: true }]
  if (refunded) return [{ label: 'Pedido reembolsado', detail: undefined, done: true }]

  const productionLabel = productionCompleted && !shipped ? 'Pronto para envio' : 'Em produção'
  let productionDetail: string | undefined
  if (productionCompleted && !shipped) {
    productionDetail = 'Itens prontos, aguardando envio'
  } else if (productionActive && production?.overall) {
    productionDetail = `${production.overall.label} · ${production.overall.progressPercent}%`
  } else if (!inProduction) {
    productionDetail = 'Inicia após pagamento'
  }

  return [
    { label: 'Pedido recebido', detail: formatDate(order.createdAt), done: true },
    { label: 'Pagamento confirmado', detail: paid ? undefined : 'Aguardando confirmação', done: paid },
    { label: productionLabel, detail: productionDetail, done: inProduction || readyOrShipped },
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

function RegeneratePixButton({ orderNumber }: { orderNumber: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/me/orders/${encodeURIComponent(orderNumber)}/regenerate-pix`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Não foi possível gerar um novo Pix.')
        return
      }
      window.location.reload()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          background: 'white',
          border: '1px solid #4A7AB5',
          borderRadius: '10px',
          color: '#4A7AB5',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Gerando...' : 'Gerar novo Pix'}
      </button>
      {error && <p role="alert" style={{ marginTop: '8px', color: '#B42318', fontSize: '13px' }}>{error}</p>}
    </div>
  )
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
