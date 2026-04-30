'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'

function OrderConfirmationContent() {
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get('pedido')

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px', textAlign: 'center' }}>
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: '48px 24px',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#1D7A72',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px' }}>
          Pedido confirmado!
        </h1>

        <p style={{ color: '#78716C', marginBottom: '24px', lineHeight: 1.6 }}>
          Obrigado pela sua compra! Recebemos o seu pedido e estamos preparando tudo com carinho.
        </p>

        {orderNumber && (
          <div style={{
            backgroundColor: '#F5F2EE',
            padding: '16px 24px',
            borderRadius: '8px',
            marginBottom: '32px',
          }}>
            <p style={{ fontSize: '14px', color: '#78716C', marginBottom: '4px' }}>
              Número do pedido
            </p>
            <p style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {orderNumber}
            </p>
          </div>
        )}

        <div style={{
          textAlign: 'left',
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)',
          marginBottom: '32px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            Próximos passos
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#F5F2EE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0,
              }}>1</span>
              <span style={{ color: '#78716C', fontSize: '14px' }}>
                Você receberá um e-mail de confirmação em breve
              </span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#F5F2EE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0,
              }}>2</span>
              <span style={{ color: '#78716C', fontSize: '14px' }}>
                O pedido entrará em produção conforme o prazo informado
              </span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#F5F2EE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0,
              }}>3</span>
              <span style={{ color: '#78716C', fontSize: '14px' }}>
                Você será notificado quando o pedido for enviado
              </span>
            </li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/produtos">
            <Button>Continuar comprando</Button>
          </Link>
          <a href="https://wa.me/55" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">Falar com atendimento</Button>
          </a>
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