'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'

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

  useEffect(() => {
    if (!orderNumber) return
    const resolvedOrderNumber = orderNumber

    async function loadOrder() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(resolvedOrderNumber)}`)
        if (!response.ok) return
        const data = await response.json()
        setOrder(data)
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [orderNumber])

  const title =
    order?.paymentStatus === 'paid' ? 'Pedido confirmado!' :
    order?.paymentMethod === 'pix' ? 'Pedido recebido, aguardando pagamento' :
    'Pedido criado com sucesso'

  const description =
    order?.paymentStatus === 'paid'
      ? 'Pagamento aprovado. Agora seguimos com a producao e atualizacoes do seu pedido.'
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
            <p style={{ fontSize: '14px', color: '#78716C', marginBottom: '4px' }}>Numero do pedido</p>
            <p style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{orderNumber}</p>
          </div>
        )}

        {loading && <p style={{ color: '#78716C' }}>Carregando status do pedido...</p>}

        {!loading && order?.paymentMethod === 'pix' && order.paymentDetails?.pixCopyPaste && (
          <div style={{ textAlign: 'left', backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Pague com Pix</h2>
            {order.paymentDetails.pixQrCodeBase64 && (
              <img
                src={`data:image/png;base64,${order.paymentDetails.pixQrCodeBase64}`}
                alt="QR Code Pix"
                style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto 16px' }}
              />
            )}
            <p style={{ color: '#78716C', fontSize: '14px', marginBottom: '8px' }}>Codigo copia e cola</p>
            <textarea
              readOnly
              value={order.paymentDetails.pixCopyPaste}
              style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #BBCFEB', resize: 'vertical' }}
            />
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
          <a href="https://wa.me/55" target="_blank" rel="noopener noreferrer"><Button variant="outline">Falar com atendimento</Button></a>
        </div>
      </div>
    </main>
  )
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '64px' }}>Carregando...</div>}>
      <OrderConfirmationContent />
    </Suspense>
  )
}
