'use client'

import { useEffect, useMemo, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import SafeImage from '@/components/SafeImage'
import TurnstileWidget from '@/components/TurnstileWidget'
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
          {product.categories?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {product.categories.map(c => (
                <span key={c.slug} style={{ color: '#4A7AB5', fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {c.name}
                </span>
              ))}
            </div>
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

          {outOfStockForVariant && (
            <RestockAlertForm productId={product.id} variantId={selectedVariant?.id || null} />
          )}

          {product.description && (
            <div style={{ borderTop: '1px solid #E3E9F4', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#1D2235' }}>
                Descricao
              </h3>
              <div style={{ color: '#6B7494', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: product.description }} />
            </div>
          )}

          <div style={{ marginTop: '32px', borderTop: '1px solid #E3E9F4', paddingTop: '24px' }}>
            <ReviewsSection productId={product.id} />
          </div>
        </div>
      </div>
    </main>
  )
}

function StarsDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} style={{ color: i <= rating ? '#F59E0B' : '#D8DCE8', fontSize: `${size}px`, lineHeight: 1 }}>★</span>,
    )
  }
  return <span aria-label={`${rating} de 5 estrelas`}>{stars}</span>
}

function StarsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Sua avaliação">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: n <= value ? '#F59E0B' : '#D8DCE8',
            fontSize: '28px',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

type ApiReview = {
  id: string
  customerName: string
  rating: number
  title: string | null
  body: string | null
  createdAt: string
}

type Aggregate = {
  count: number
  approvedCount: number
  averageRating: number | null
  distribution: Record<string, number>
}

function ReviewsSection({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [aggregate, setAggregate] = useState<Aggregate | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, { cache: 'no-store' })
      if (!res.ok) {
        setReviews([]); setAggregate(null); return
      }
      const data = await res.json()
      setReviews(data.reviews || [])
      setAggregate(data.aggregate || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [productId])

  return (
    <div>
      <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: '#1D2235' }}>Avaliações</h3>
      {aggregate && aggregate.approvedCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <StarsDisplay rating={Math.round(aggregate.averageRating || 0)} size={20} />
          <span style={{ fontWeight: 600, color: '#1D2235' }}>
            {aggregate.averageRating?.toFixed(1).replace('.', ',')} de 5
          </span>
          <span style={{ color: '#6B7494', fontSize: '14px' }}>
            ({aggregate.approvedCount} {aggregate.approvedCount === 1 ? 'avaliação' : 'avaliações'})
          </span>
        </div>
      ) : (
        <p style={{ color: '#6B7494', marginBottom: '20px' }}>Ainda não há avaliações deste produto.</p>
      )}

      <ReviewForm productId={productId} onSubmitted={load} />

      {loading ? (
        <p style={{ color: '#6B7494', marginTop: '20px' }}>Carregando avaliações...</p>
      ) : reviews.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '24px', display: 'grid', gap: '16px' }}>
          {reviews.map(review => (
            <li key={review.id} style={{ background: '#F9FBFD', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontWeight: 600, color: '#1D2235' }}>{review.customerName}</div>
                <StarsDisplay rating={review.rating} size={14} />
              </div>
              {review.title && <p style={{ fontWeight: 600, margin: '8px 0 4px', color: '#1D2235' }}>{review.title}</p>}
              {review.body && <p style={{ margin: 0, color: '#3D4460', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{review.body}</p>}
              <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '8px' }}>
                {new Date(review.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ReviewForm({ productId, onSubmitted }: { productId: string; onSubmitted: () => void }) {
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch(`/api/me/reviews?productId=${encodeURIComponent(productId)}`, { cache: 'no-store' })
        if (cancelled) return
        if (res.status === 401) {
          setEligibility(null)
        } else if (res.ok) {
          setEligibility(await res.json())
        } else {
          setEligibility({ eligible: false, reason: 'no_paid_order' })
        }
      } catch {
        setEligibility(null)
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    }
    check()
    return () => { cancelled = true }
  }, [productId])

  if (!authChecked) return null

  if (!eligibility) {
    return null // not logged in — don't show the form
  }

  if (!eligibility.eligible) {
    if (eligibility.reason === 'already_reviewed') {
      return (
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#6B7494' }}>
          Você já avaliou este produto. Obrigado!
        </p>
      )
    }
    return null // not eligible (no paid order) — don't expose UI noise
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/me/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating, title: title.trim() || null, body: body.trim() || null }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Não foi possível enviar.')
        return
      }
      setSubmitted(true)
      setTitle('')
      setBody('')
      onSubmitted()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ marginTop: '12px', padding: '12px 16px', background: '#DCFCE7', borderRadius: '10px', color: '#166534', fontSize: '14px' }}>
        Sua avaliação foi enviada e está aguardando moderação. Obrigado!
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '16px', padding: '16px', background: '#F9FBFD', borderRadius: '12px', border: '1px solid #E3E9F4' }}>
      <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1D2235' }}>Avalie sua compra</h4>
      <p style={{ fontSize: '13px', color: '#6B7494', margin: '4px 0 12px' }}>
        Sua avaliação será exibida após aprovação.
      </p>
      <StarsInput value={rating} onChange={setRating} />
      <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          maxLength={120}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8' }}
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Conte como foi sua experiência (opcional)"
          maxLength={2000}
          rows={4}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', resize: 'vertical', fontFamily: 'inherit' }}
        />
        {error && <p role="alert" style={{ margin: 0, color: '#B42318', fontSize: '13px' }}>{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', justifySelf: 'start', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Enviando...' : 'Enviar avaliação'}
        </button>
      </div>
    </form>
  )
}

function RestockAlertForm({ productId, variantId }: { productId: string; variantId: string | null }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Informe seu e-mail.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/products/restock-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), productId, variantId, turnstileToken }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Não foi possível registrar agora.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        marginBottom: '32px',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #E3E9F4',
        background: '#F9FBFD',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#1D2235' }}>
        Receba um aviso quando voltar
      </p>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B7494' }}>
        Deixe seu e-mail e te avisamos assim que este produto estiver disponível novamente.
      </p>

      {submitted ? (
        <p style={{ margin: 0, color: '#1D7A72', fontSize: '14px', fontWeight: 600 }}>
          Pronto! Vamos te avisar.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              style={{ flex: 1, minWidth: '200px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8' }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#1D2235',
                color: 'white',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Salvando...' : 'Avise-me'}
            </button>
          </div>
          <TurnstileWidget onToken={setTurnstileToken} />
          {error && <p role="alert" style={{ margin: 0, color: '#B42318', fontSize: '13px' }}>{error}</p>}
        </form>
      )}
    </div>
  )
}
