'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import Input from '@/components/Input'
import { useCart } from '@/context/CartContext'
import { Product } from '@/lib/types'

interface ProductDetailClientProps {
  product: Product
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]?.id || null)
  const [quantity, setQuantity] = useState(1)
  const [personalization, setPersonalization] = useState<Record<string, string>>({})
  const { addItem } = useCart()

  const currentPrice = product.price + (product.variants.find(v => v.id === selectedVariant)?.priceDelta || 0)

  const handleAddToCart = () => {
    const requiredFields = product.personalizationFields.filter(f => f.isRequired)
    const missingRequired = requiredFields.find(f => !personalization[f.id])

    if (missingRequired) {
      alert(`Por favor, preencha o campo: ${missingRequired.label}`)
      return
    }

    const selectedVariantObj = product.variants.find(v => v.id === selectedVariant)

    addItem({
      productId: product.id,
      productName: product.name,
      productImage: product.images[0]?.url || null,
      variantId: selectedVariant,
      variantName: selectedVariantObj?.name || null,
      quantity,
      unitPrice: currentPrice,
      personalization: Object.keys(personalization).length > 0 ? personalization : null,
    })
  }

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '32px',
      }}>
        <div>
          <div style={{
            aspectRatio: '4/3',
            backgroundColor: '#F5F2EE',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}>
            {product.images[selectedImage] ? (
              <img
                src={product.images[selectedImage].url}
                alt={product.images[selectedImage].alt || product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#78716C',
              }}>
                Sem imagem
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(idx)}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: selectedImage === idx ? '2px solid #C8552A' : '2px solid transparent',
                    padding: 0,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.alt || `${product.name} - ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <span style={{ color: '#78716C', fontSize: '14px' }}>
              {product.category.name}
            </span>
          )}

          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            {product.name}
          </h1>

          {product.sku && (
            <p style={{ color: '#78716C', fontSize: '14px', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
              SKU: {product.sku}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '28px',
              fontWeight: 600,
              color: '#1C1917',
            }}>
              R$ {currentPrice.toFixed(2).replace('.', ',')}
            </span>
            {product.compareAtPrice && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '18px',
                color: '#78716C',
                textDecoration: 'line-through',
              }}>
                R$ {product.compareAtPrice.toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>

          {product.shortDescription && (
            <p style={{ color: '#78716C', marginBottom: '24px', lineHeight: 1.6 }}>
              {product.shortDescription}
            </p>
          )}

          {product.variants.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                Opção
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {product.variants.map(variant => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: selectedVariant === variant.id ? '2px solid #C8552A' : '1px solid #E8E2DA',
                      backgroundColor: selectedVariant === variant.id ? '#FFF5F2' : 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.personalizationFields.length > 0 && (
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#F5F2EE', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                Personalização
              </h3>
              {product.personalizationFields.map(field => (
                <div key={field.id} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                    {field.label}
                    {field.isRequired && <span style={{ color: '#C8552A' }}> *</span>}
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
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid #E8E2DA',
                        fontSize: '16px',
                        fontFamily: 'var(--font-body)',
                        minHeight: '100px',
                        resize: 'vertical',
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
                    <p style={{ fontSize: '12px', color: '#78716C', marginTop: '4px' }}>
                      {field.helpText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '4px',
                  border: '1px solid #E8E2DA',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                -
              </button>
              <span style={{ minWidth: '40px', textAlign: 'center', fontSize: '16px' }}>
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '4px',
                  border: '1px solid #E8E2DA',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                +
              </button>
            </div>

            <p style={{ color: '#78716C', fontSize: '14px' }}>
              Prazo de produção: {product.productionTimeMinDays}-{product.productionTimeMaxDays} dias úteis
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            <Button onClick={handleAddToCart} fullWidth>
              Adicionar ao carrinho
            </Button>
            <Button variant="outline" style={{ padding: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </Button>
          </div>

          {product.description && (
            <div style={{ borderTop: '1px solid #E8E2DA', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                Descrição
              </h3>
              <div style={{ color: '#78716C', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: product.description }} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}