'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import Badge from './Badge'
import SafeImage from './SafeImage'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/context/WishlistContext'

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
  averageRating?: number | null
  reviewCount?: number
}

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { isFavorite, toggle } = useWishlist()

  if (!product) {
    return null
  }

  const mainImage = product.images?.[0]
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercent = hasDiscount && product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0
  const favorited = isFavorite(product.id)
  // Antes era restrito a `role === 'customer'`, mas isso bloqueava admin
  // (que tem conta válida e expectativa razoável de favoritar). Agora
  // qualquer usuário logado pode favoritar.
  const isLoggedIn = Boolean(user)

  async function handleFavoriteClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedIn) {
      const next = pathname && pathname !== '/login' ? pathname : '/produtos'
      router.push(`/login?redirect=${encodeURIComponent(next)}`)
      return
    }
    await toggle(product.id)
  }

  return (
    <article
      className="product-card"
      style={{
        position: 'relative',
        backgroundColor: 'white',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
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
        <SafeImage
          src={mainImage?.url}
          alt={mainImage?.alt || product.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {product.isPersonalizable && (
          <Badge
            variant="new"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 2,
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
              zIndex: 2,
            }}
          >
            {discountPercent}% off
          </Badge>
        )}

        <button
          type="button"
          onClick={handleFavoriteClick}
          className="product-card__fav"
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            zIndex: 2,
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
          aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={favorited}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={favorited ? '#D4849A' : 'none'}
            stroke="#D4849A"
            strokeWidth="1.5"
            aria-hidden="true"
          >
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
            textWrap: 'balance' as React.CSSProperties['textWrap'],
          }}
        >
          <Link
            href={`/produtos/${product.slug}`}
            className="product-card__link"
            style={{ color: 'inherit' }}
          >
            {product.name}
          </Link>
        </h3>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
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
                fontVariantNumeric: 'tabular-nums',
                fontSize: '14px',
                color: '#A8AFCA',
                textDecoration: 'line-through',
              }}
            >
              R$ {product.compareAtPrice?.toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>

        {product.averageRating != null && (product.reviewCount ?? 0) > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6B7494' }}>
            <span style={{ color: '#F59E0B', fontSize: '14px', lineHeight: 1 }} aria-hidden="true">★</span>
            <span style={{ fontWeight: 600, color: '#1D2235' }}>{product.averageRating.toFixed(1).replace('.', ',')}</span>
            <span aria-label={`${product.reviewCount} avaliações`}>({product.reviewCount})</span>
          </div>
        )}
      </div>
    </article>
  )
}
