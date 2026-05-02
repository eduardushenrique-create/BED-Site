'use client'

import { useMemo, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import SafeImage from '@/components/SafeImage'
import { useCart } from '@/context/CartContext'
import { Product, ProductImage, ProductVariant } from '@/lib/types'

interface ProductDetailClientProps {
  product: Product | null | undefined
}

function describeVariant(variant: ProductVariant): string {
  const parts = [variant.color, variant.size, variant.material, variant.finish].filter(
    (value): value is string => Boolean(value && value.trim()),
  )
  if (parts.length === 0) return variant.name
  // If the saved name already encodes the attributes, prefer it; otherwise compose.
  const composed = parts.join(' - ')
  return variant.name && variant.name.trim() && variant.name !== 'Padrao'
    ? variant.name
    : composed
}

function variantEffectivePrice(basePrice: number, variant: ProductVariant | null): number {
  if (!variant) return basePrice
  if (variant.priceOverride != null) return variant.priceOverride
  return basePrice + (variant.priceDelta || 0)
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const initialVariantId = useMemo(() => {
    if (!product || product.variants.length === 0) return null
    const firstAvailable = product.variants.find(v => v.isAvailable !== false)
    return (firstAvailable || product.variants[0]).id
  }, [product])

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(initialVariantId)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [personalization, setPersonalization] = useState<Record<string, string>>({})
  const { addItem } = useCart()

  const selectedVariant: ProductVariant | null = useMemo(() => {
    if (!product || !selectedVariantId) return null
    return product.variants.find(v => v.id === selectedVariantId) || null
  }, [product, selectedVariantId])

  // Filter gallery: variant-specific images first, then global product images (no variantId).
  const visibleImages: ProductImage[] = useMemo(() => {
    if (!product) return []
    if (!selectedVariant) {
      return product.images.filter(img => !img.variantId)
        .concat(product.images.filter(img => img.variantId))
    }
    const variantImages = product.images.filter(img => img.variantId === selectedVariant.id)
    const globalImages = product.images.filter(img => !img.variantId)
    if (variantImages.length > 0) return [...variantImages, ...globalImages]
    return globalImages.length > 0 ? globalImages : product.images
  }, [product, selectedVariant])

  if (!product) {
    return (
      <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px', textAlign: 'center' }}>
        <h1 style={{ color: '#1D2235' }}>Produto nao encontrado</h1>
        <p style={{ color: '#6B7494' }}>Este produto nao esta disponivel.</p>
      </main>
    )
  }

  const currentPrice = variantEffectivePrice(product.price, selectedVariant)
  const safeImageIndex = Math.min(selectedImageIndex, Math.max(0, visibleImages.length - 1))
  const heroImage = visibleImages[safeImageIndex] || product.images[0]

  // Availability rules
  const hasVariants = product.variants.length > 0
  const variantStock = selectedVariant?.stockQuantity ?? 0
  const variantAvailable = selectedVariant ? selectedVariant.isAvailable !== false : true
  const underOrder = !!product.underOrder
  const outOfStockForVariant = hasVariants
    ? !underOrder && (!variantAvailable || variantStock <= 0)
    : !underOrder && (product.stock ?? 0) <= 0

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariantId(variantId)
    setSelectedImageIndex(0)
  }

  const handleAddToCart = () => {
    if (outOfStockForVariant) return
    if (hasVariants && !selectedVariant) {
      alert('Selecione uma variacao.')
      return
    }

    const requiredFields = product.personalizationFields.filter(f => f.isRequired)
    const missingRequired = requiredFields.find(f => !personalization[f.id])
    if (missingRequired) {
      alert(`Por favor, preencha o campo: ${missingRequired.label}`)
      return
    }

    const variantLabel = selectedVariant ? describeVariant(selectedVariant) : null

    addItem({
      productId: product.id,
      productName: product.name,
      productImage: heroImage?.url || product.images[0]?.url || null,
      variantId: selectedVariant?.id || null,
      variantName: variantLabel,
      quantity,
      unitPrice: currentPrice,
      personalization: Object.keys(personalization).length > 0 ? personalization : null,
    })
  }

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <div
        className="product-detail-layout"
        style={{
          display: 'grid',
          gap: '32px',
          alignItems: 'start',
        }}
      >
        <div>
          <div
            style={{
              aspectRatio: '4/3',
              backgroundColor: '#E4EDF8',
              borderRadius: '18px',
              overflow: 'hidden',
              marginBottom: '16px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <SafeImage
              src={heroImage?.url}
              alt={heroImage?.alt || product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {visibleImages.length > 1 && (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              {visibleImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIndex(idx)}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: safeImageIndex === idx ? '2px solid #BBCFEB' : '2px solid transparent',
                    padding: 0,
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: '#E4EDF8',
                  }}
                >
                  <SafeImage src={img.url} alt={img.alt || `${product.name} - ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '18px',
            padding: '28px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {product.category && (
            <span style={{ color: '#4A7AB5', fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {product.category.name}
            </span>
          )}

          <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 700, marginBottom: '10px', color: '#1D2235', marginTop: '8px' }}>
            {product.name}
          </h1>

          {product.sku && (
            <p style={{ color: '#6B7494', fontSize: '14px', fontFamily: 'var(--font-mono)', marginBottom: '18px' }}>
              SKU: {selectedVariant?.sku || product.sku}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '30px',
                fontWeight: 600,
                color: '#1D2235',
              }}
            >
              R$ {currentPrice.toFixed(2).replace('.', ',')}
            </span>
            {product.compareAtPrice && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '18px',
                  color: '#A8AFCA',
                  textDecoration: 'line-through',
                }}
              >
                R$ {product.compareAtPrice.toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>

          {product.shortDescription && (
            <p style={{ color: '#6B7494', marginBottom: '24px', lineHeight: 1.7 }}>
              {product.shortDescription}
            </p>
          )}

          {hasVariants && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#1D2235' }}>
                Variacao
              </label>
              <div style={{ display: 'grid', gap: '8px' }}>
                {product.variants.map(variant => {
                  const label = describeVariant(variant)
                  const price = variantEffectivePrice(product.price, variant)
                  const stock = variant.stockQuantity ?? 0
                  const available = variant.isAvailable !== false
                  const isSoldOut = !underOrder && (!available || stock <= 0)
                  const isSelected = selectedVariantId === variant.id
                  return (
                    <button
                      type="button"
                      key={variant.id}
                      onClick={() => handleSelectVariant(variant.id)}
                      disabled={isSoldOut}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #BBCFEB' : '1px solid #D8DCE8',
                        backgroundColor: isSelected ? '#F0F5FB' : 'white',
                        cursor: isSoldOut ? 'not-allowed' : 'pointer',
                        opacity: isSoldOut ? 0.55 : 1,
                        textAlign: 'left',
                        color: '#1D2235',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#6B7494' }}>
                        {isSoldOut ? (
                          <span style={{ color: '#A3526A', fontWeight: 600 }}>Esgotado</span>
                        ) : underOrder ? (
                          <span>Sob encomenda</span>
                        ) : (
                          <span>{stock} em estoque</span>
                        )}
                        <strong style={{ color: '#1D2235', fontFamily: 'var(--font-mono)' }}>
                          R$ {price.toFixed(2).replace('.', ',')}
                        </strong>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {product.personalizationFields.length > 0 && (
            <div style={{ marginBottom: '24px', padding: '18px', backgroundColor: '#FAFCFE', borderRadius: '14px', border: '1px solid #E3E9F4' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#1D2235' }}>
                Personalizacao
              </h3>
              {product.personalizationFields.map(field => (
                <div key={field.id} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
                    {field.label}
                    {field.isRequired && <span style={{ color: '#A3526A' }}> *</span>}
                  </label>
                  {field.fieldType === 'textarea' ? (
                    <textarea
                      placeholder={field.placeholder || ''}
                      required={field.isRequired}
                      minLength={field.minLength || undefined}
                      maxLength={field.maxLength || undefined}
                      value={personalization[field.id] || ''}
                      onChange={e => setPersonalization({ ...personalization, [field.id]: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid #D8DCE8',
                        fontSize: '16px',
                        fontFamily: 'var(--font-body)',
                        minHeight: '100px',
                        resize: 'vertical',
                        color: '#1D2235',
                      }}
                    />
                  ) : (
                    <Input
                      type={field.fieldType === 'number' ? 'number' : 'text'}
                      placeholder={field.placeholder || ''}
                      required={field.isRequired}
                      minLength={field.minLength || undefined}
                      maxLength={field.maxLength || undefined}
                      value={personalization[field.id] || ''}
                      onChange={e => setPersonalization({ ...personalization, [field.id]: e.target.value })}
                    />
                  )}
                  {field.helpText && (
                    <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '4px' }}>
                      {field.helpText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #D8DCE8',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                -
              </button>
              <span style={{ minWidth: '40px', textAlign: 'center', fontSize: '16px', color: '#1D2235' }}>{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #D8DCE8',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                +
              </button>
            </div>

            <p style={{ color: '#6B7494', fontSize: '14px' }}>
              Prazo de producao: {product.productionTimeMinDays}-{product.productionTimeMaxDays} dias uteis
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            <Button onClick={handleAddToCart} fullWidth disabled={outOfStockForVariant}>
              {outOfStockForVariant ? 'Esgotado' : 'Adicionar ao carrinho'}
            </Button>
            <Button variant="outline" style={{ padding: '12px 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </Button>
          </div>

          {product.description && (
            <div style={{ borderTop: '1px solid #E3E9F4', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#1D2235' }}>
                Descricao
              </h3>
              <div style={{ color: '#6B7494', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: product.description }} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
