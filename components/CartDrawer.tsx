'use client'

import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import Button from './Button'

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, subtotal, itemCount } = useCart()

  if (!isOpen) return null

  return (
    <>
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }}
      />
      
      <aside style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'white',
        boxShadow: '0 8px 40px rgba(0,0,0,0.14)',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <header style={{
          padding: '16px 24px',
          borderBottom: '1px solid #E8E2DA',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
            Carrinho ({itemCount})
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
            }}
            aria-label="Fechar carrinho"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="1.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: '#78716C', marginBottom: '16px' }}>
                Seu carrinho está vazio
              </p>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Continuar comprando
              </Button>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((item, idx) => (
                <li key={`${item.productId}-${item.variantId}-${idx}`} style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px 0',
                  borderBottom: '1px solid #E8E2DA',
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#F5F2EE',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78716C' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <path d="M21 15l-5-5L5 21"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                      {item.productName}
                    </h3>
                    {item.variantName && (
                      <p style={{ fontSize: '12px', color: '#78716C', marginBottom: '8px' }}>
                        {item.variantName}
                      </p>
                    )}
                    {item.personalization && Object.keys(item.personalization).length > 0 && (
                      <p style={{ fontSize: '12px', color: '#78716C', marginBottom: '8px' }}>
                        {Object.values(item.personalization).join(', ')}
                      </p>
                    )}
                    <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                      R$ {item.unitPrice.toFixed(2).replace('.', ',')}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '4px',
                          border: '1px solid #E8E2DA',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        -
                      </button>
                      <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '14px' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '4px',
                          border: '1px solid #E8E2DA',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </button>

                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          border: 'none',
                          color: '#C8552A',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer style={{
            padding: '16px 24px',
            borderTop: '1px solid #E8E2DA',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '16px', fontWeight: 500 }}>Subtotal</span>
              <span style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                R$ {subtotal.toFixed(2).replace('.', ',')}
              </span>
            </div>
            
            <Link href="/checkout" style={{ display: 'block' }} onClick={() => setIsOpen(false)}>
              <Button fullWidth>Finalizar compra</Button>
            </Link>
            
            <button
              onClick={() => setIsOpen(false)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '8px',
                padding: '12px',
                background: 'none',
                border: 'none',
                color: '#78716C',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Continuar comprando
            </button>
          </footer>
        )}
      </aside>
    </>
  )
}