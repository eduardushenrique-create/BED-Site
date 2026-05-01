'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { useCart } from '@/context/CartContext'
import { Product } from '@/lib/types'

interface ProductDetailClientProps {
  product: Product | null | undefined
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState(product?.variants[0]?.id || null)
  const [quantity, setQuantity] = useState(1)
  const [personalization, setPersonalization] = useState<Record<string, string>>({})
  const { addItem } = useCart()

  if (!product) {
    return (
      <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px', textAlign: 'center' }}>
        <h1 style={{ color: '#1D2235' }}>Produto não encontrado</h1>
        <p style={{ color: '#6B7494' }}>Este produto não está disponível.</p>
      </main>
    )
  }

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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
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
            {product.images[selectedImage] ? (
              <img
                src={product.images[selectedImage].url}
                alt={product.images[selectedImage].alt || product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                  fontWeight: 600,
                }}
              >
                Sem imagem
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(idx)}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: selectedImage === idx ? '2px solid #BBCFEB' : '2px solid transparent',
                    padding: 0,
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: '#E4EDF8',
                  }}
                >
                  <img src={img.url} alt={img.alt || `${product.name} - ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              SKU: {product.sku}
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

          {product.variants.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#1D2235' }}>
                Opção
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {product.variants.map(variant => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant.id)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: selectedVariant === variant.id ? '2px solid #BBCFEB' : '1px solid #D8DCE8',
                      backgroundColor: selectedVariant === variant.id ? '#F0F5FB' : 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#1D2235',
                    }}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.personalizationFields.length > 0 && (
            <div style={{ marginBottom: '24px', padding: '18px', backgroundColor: '#FAFCFE', borderRadius: '14px', border: '1px solid #E3E9F4' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#1D2235' }}>
                Personalização
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
              Prazo de produção: {product.productionTimeMinDays}-{product.productionTimeMaxDays} dias úteis
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            <Button onClick={handleAddToCart} fullWidth>
              Adicionar ao carrinho
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
                Descrição
              </h3>
              <div style={{ color: '#6B7494', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: product.description }} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
