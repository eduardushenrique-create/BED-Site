'use client'

import Link from 'next/link'
import Badge from './Badge'

interface ProductImage {
  id: string
  url: string
  alt: string | null
}

interface ProductVariant {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  isPersonalizable: boolean
  images: ProductImage[]
  variants: ProductVariant[]
}

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  if (!product) {
    return null
  }

  const mainImage = product.images?.[0]
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercent = hasDiscount && product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  return (
    <Link href={`/produtos/${product.slug}`}>
      <article
        style={{
          backgroundColor: 'white',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
          transition: 'transform var(--transition-fast)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: '4/3',
            backgroundColor: '#E4EDF8',
            overflow: 'hidden',
          }}
        >
          {mainImage ? (
            <img
              src={mainImage.url}
              alt={mainImage.alt || product.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8AAFD8',
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}

          {product.isPersonalizable && (
            <Badge
              variant="new"
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
              }}
            >
              Personalizável
            </Badge>
          )}

          {hasDiscount && (
            <Badge
              variant="sale"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
              }}
            >
              {discountPercent}% off
            </Badge>
          )}

          <button
            onClick={(e) => {
              e.preventDefault()
            }}
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(29,34,53,0.1)',
            }}
            aria-label="Adicionar aos favoritos"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4849A" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#1D2235',
              lineHeight: 1.3,
            }}
          >
            {product.name}
          </h3>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '20px',
                fontWeight: 600,
                color: '#1D2235',
              }}
            >
              R$ {product.price.toFixed(2).replace('.', ',')}
            </span>

            {hasDiscount && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: '#A8AFCA',
                  textDecoration: 'line-through',
                }}
              >
                R$ {product.compareAtPrice?.toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
