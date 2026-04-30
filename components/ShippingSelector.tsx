'use client'

import { useState, useEffect } from 'react'

interface ShippingQuote {
  id: string
  name: string
  price: number
  deliveryTime: {
    days: number
    min?: number
    max?: number
  }
  company: {
    name: string
    picture: string
  }
}

interface CartItem {
  productId: string
  weightGrams: number
  widthCm: number
  heightCm: number
  depthCm: number
  quantity: number
}

interface ShippingSelectorProps {
  address: {
    zipCode: string
  }
  cartItems: CartItem[]
  onSelect: (quote: ShippingQuote) => void
  selectedShippingId?: string
}

export default function ShippingSelector({ address, cartItems, onSelect, selectedShippingId }: ShippingSelectorProps) {
  const [quotes, setQuotes] = useState<ShippingQuote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const normalizedZipCode = address.zipCode.replace(/\D/g, '')
  const canCalculateShipping = normalizedZipCode.length >= 8

  useEffect(() => {
    if (!canCalculateShipping) {
      return
    }

    async function fetchShipping() {
      setLoading(true)
      setError(null)

      try {
        const packageInfo = {
          weight: cartItems.reduce((sum, item) => sum + (item.weightGrams * item.quantity), 0),
          dimensions: {
            width: Math.max(...cartItems.map(i => i.widthCm), 10),
            height: Math.max(...cartItems.map(i => i.heightCm), 10),
            length: Math.max(...cartItems.map(i => i.depthCm), 10),
          }
        }

        const response = await fetch('/api/shipping/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromPostalCode: process.env.NEXT_PUBLIC_SHIPPING_ORIGIN_CEP || '01001000',
            toPostalCode: normalizedZipCode,
            packageInfo,
          }),
        })

        if (!response.ok) {
          throw new Error('Erro ao calcular frete')
        }

        const data = await response.json()
        setQuotes(data)
      } catch (err) {
        console.error('Shipping error:', err)
        setError('Não foi possível calcular o frete')
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchShipping, 500)
    return () => clearTimeout(timer)
  }, [canCalculateShipping, normalizedZipCode, cartItems])

  const formatDeliveryTime = (quote: ShippingQuote) => {
    const { days, min, max } = quote.deliveryTime
    if (min && max) {
      return `${min}-${max} dias úteis`
    }
    if (days === 1) {
      return '1 dia útil'
    }
    return `${days} dias úteis`
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#78716C' }}>
        Calculando frete...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#EF4444' }}>
        {error}
      </div>
    )
  }

  if (!canCalculateShipping || quotes.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#78716C' }}>
        Informe o CEP para calcular o frete
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {quotes.map(quote => (
        <label
          key={quote.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            borderRadius: '8px',
            border: selectedShippingId === quote.id ? '2px solid #C8552A' : '1px solid #E8E2DA',
            backgroundColor: selectedShippingId === quote.id ? '#FFF5F2' : 'white',
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="shipping"
            value={quote.id}
            checked={selectedShippingId === quote.id}
            onChange={() => onSelect(quote)}
            style={{ accentColor: '#C8552A' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{quote.company.name} - {quote.name}</div>
            <div style={{ fontSize: '14px', color: '#78716C' }}>
              {formatDeliveryTime(quote)}
            </div>
          </div>
          <div style={{ fontWeight: 600 }}>
            R$ {quote.price.toFixed(2).replace('.', ',')}
          </div>
        </label>
      ))}
    </div>
  )
}
