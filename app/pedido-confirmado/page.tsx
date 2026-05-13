'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API may be unavailable on older browsers
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="focus-ring"
      style={{
        marginTop: '8px',
        padding: '10px 16px',
        borderRadius: '8px',
        border: '1px solid #1D2235',
        background: copied ? '#1D7A72' : '#1D2235',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color var(--transition-fast)',
      }}
      aria-live="polite"
    >
      {copied ? 'Código copiado!' : 'Copiar código Pix'}
    </button>
  )
}

type OrderData = {
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  paymentDetails?: {
    status: string
    statusDetail?: string
    checkoutUrl?: string
    pixQrCodeBase64?: string
    pixCopyPaste?: string
  }
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get('pedido')
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(Boolean(orderNumber))
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  async function loadOrder() {
    if (!orderNumber) return
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`)
      if (!response.ok) return
      const data = await response.json()
      setOrder(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber])

  async function handleGeneratePix() {
    if (!orderNumber) return
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch(
        `/api/me/orders/${encodeURIComponent(orderNumber)}/regenerate-pix`,
        { method: 'POST' },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setGenerateError(data?.error || 'Não foi possível gerar o Pix agora. Tente novamente.')
        return
      }
      // Recarrega o pedido pra pegar QR + copia-cola atualizados
      await loadOrder()
    } catch {
      setGenerateError('Erro de conexão. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }

  const isPixPending =
    order?.paymentMethod === 'pix' && order.paymentStatus !== 'paid'
  const hasPixData = Boolean(order?.paymentDetails?.pixCopyPaste)

  const title =
    order?.paymentStatus === 'paid' ? 'Pedido confirmado!' :
    order?.paymentMethod === 'pix' ? 'Pedido recebido, aguardando pagamento' :
    'Pedido criado com sucesso'

  const description =
    order?.paymentStatus === 'paid'
      ? 'Pagamento aprovado. Agora seguimos com a produção e atualizações do seu pedido.'
      : order?.paymentMethod === 'pix'
        ? 'Seu pedido foi registrado. Finalize o Pix abaixo para confirmar o pagamento.'
        : 'Seu pedido foi criado. Conclua o pagamento no checkout seguro para confirmar.'

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px', textAlign: 'center' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: order?.paymentStatus === 'paid' ? '#1D7A72' : '#D4849A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px' }}>{title}</h1>
        <p style={{ color: '#78716C', marginBottom: '24px', lineHeight: 1.6 }}>{description}</p>

        {orderNumber && (
          <div style={{ backgroundColor: '#F5F2EE', padding: '16px 24px', borderRadius: '8px', marginBottom: '32px' }}>
            <p style={{ fontSize: '14px', color: '#78716C', marginBottom: '4px' }}>Número do pedido</p>
            <p style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} translate="no">{orderNumber}</p>
          </div>
        )}

        {loading && <p role="status" aria-live="polite" style={{ color: '#78716C' }}>Carregando status do pedido…</p>}

        {!loading && isPixPending && !hasPixData && (
          <div style={{ textAlign: 'left', backgroundColor: '#FEF3C7', padding: '20px 24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #F5D58F' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#92400E' }}>
              Pix ainda não foi gerado
            </h2>
            <p style={{ color: '#78716C', fontSize: '14px', marginBottom: '16px', lineHeight: 1.5 }}>
              Houve uma falha ao gerar o código Pix automaticamente quando você finalizou o pedido. Clique abaixo para tentar de novo — o pedido continua válido.
            </p>
            <Button onClick={handleGeneratePix} disabled={generating}>
              {generating ? 'Gerando…' : 'Gerar QR Code agora'}
            </Button>
            {generateError && (
              <p role="alert" style={{ color: '#B42318', fontSize: '13px', marginTop: '12px' }}>
                {generateError}
              </p>
            )}
          </div>
        )}

        {!loading && order?.paymentMethod === 'pix' && order.paymentDetails?.pixCopyPaste && (
          <div style={{ textAlign: 'left', backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Pague com Pix</h2>
            {order.paymentDetails.pixQrCodeBase64 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`data:image/png;base64,${order.paymentDetails.pixQrCodeBase64}`}
                alt="QR Code para pagamento via Pix"
                width={220}
                height={220}
                style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto 16px' }}
              />
            )}
            <label htmlFor="pix-copy-paste" style={{ display: 'block', color: '#78716C', fontSize: '14px', marginBottom: '8px' }}>Código copia e cola</label>
            <textarea
              id="pix-copy-paste"
              readOnly
              value={order.paymentDetails.pixCopyPaste}
              translate="no"
              onFocus={e => e.currentTarget.select()}
              style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #BBCFEB', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
            />
            <CopyButton value={order.paymentDetails.pixCopyPaste} />
          </div>
        )}

        {!loading && order?.paymentMethod === 'card' && order.paymentDetails?.checkoutUrl && order.paymentStatus !== 'paid' && (
          <div style={{ marginBottom: '24px' }}>
            <a href={order.paymentDetails.checkoutUrl}>
              <Button>Ir para o pagamento seguro</Button>
            </a>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/produtos"><Button>Continuar comprando</Button></Link>
          <a href="https://wa.me/5511978871566" target="_blank" rel="noopener noreferrer"><Button variant="outline">Falar com atendimento</Button></a>
        </div>
      </div>
    </main>
  )
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '64px' }}>Carregando…</div>}>
      <OrderConfirmationContent />
    </Suspense>
  )
}
