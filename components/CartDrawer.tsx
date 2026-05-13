'use client'

import { useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import Button from './Button'

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, subtotal, itemCount } = useCart()
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // ESC to close + initial focus + restore focus on close
  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocusRef.current?.focus?.()
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        aria-hidden="true"
        onClick={() => setIsOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(29,34,53,0.4)',
          zIndex: 200,
          backdropFilter: 'blur(2px)',
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'white',
          boxShadow: '0 8px 40px rgba(29,34,53,0.18)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          overscrollBehavior: 'contain',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <header
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #EEF1F8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 id={titleId} style={{ fontSize: '22px', fontWeight: 700, color: '#1D2235' }}>Carrinho ({itemCount})</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setIsOpen(false)}
            className="icon-btn focus-ring"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: '#6B7494',
            }}
            aria-label="Fechar carrinho"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '16px 24px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: '#6B7494', marginBottom: '16px' }}>Seu carrinho está vazio</p>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Continuar comprando
              </Button>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((item, idx) => (
                <li
                  key={`${item.productId}-${item.variantId}-${idx}`}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px 0',
                    borderBottom: '1px solid #EEF1F8',
                  }}
                >
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      backgroundColor: '#E4EDF8',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {item.productImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        width={80}
                        height={80}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div role="img" aria-label={item.productName} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8AAFD8' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: '#1D2235' }}>{item.productName}</h3>
                    {item.variantName && <p style={{ fontSize: '12px', color: '#6B7494', marginBottom: '8px' }}>{item.variantName}</p>}
                    {item.personalization && Object.keys(item.personalization).length > 0 && (
                      <p style={{ fontSize: '12px', color: '#6B7494', marginBottom: '8px' }}>{Object.values(item.personalization).join(', ')}</p>
                    )}
                    <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#1D2235', fontVariantNumeric: 'tabular-nums' }}>
                      R$ {item.unitPrice.toFixed(2).replace('.', ',')}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                        aria-label={`Diminuir quantidade de ${item.productName}`}
                        className="icon-btn focus-ring"
                        style={{
                          borderRadius: '8px',
                          border: '1px solid #D8DCE8',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '18px',
                          lineHeight: 1,
                        }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                        aria-label={`Aumentar quantidade de ${item.productName}`}
                        className="icon-btn focus-ring"
                        style={{
                          borderRadius: '8px',
                          border: '1px solid #D8DCE8',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '18px',
                          lineHeight: 1,
                        }}
                      >
                        +
                      </button>

                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.variantId)}
                        aria-label={`Remover ${item.productName} do carrinho`}
                        className="focus-ring"
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          border: 'none',
                          color: '#A3526A',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          padding: '8px 4px',
                          textDecoration: 'underline',
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
          <footer
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #EEF1F8',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '16px', fontWeight: 500, color: '#6B7494' }}>Subtotal</span>
              <span style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: '#1D2235' }}>
                R$ {subtotal.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <Link href="/checkout" style={{ display: 'block' }} onClick={() => setIsOpen(false)}>
              <Button fullWidth>Finalizar compra</Button>
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="focus-ring"
              style={{
                display: 'block',
                width: '100%',
                marginTop: '8px',
                padding: '12px',
                background: 'none',
                border: 'none',
                color: '#6B7494',
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
