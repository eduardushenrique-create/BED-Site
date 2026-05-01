'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

export interface Banner {
  id: string
  title: string
  subtitle?: string
  imageUrl: string
  ctaText?: string
  ctaLink?: string
  isActive: boolean
  displayDurationSeconds?: number
}

const defaultBanners: Banner[] = [
  {
    id: '1',
    title: 'Presentes feitos para durar.',
    subtitle: 'Cada peça é impressa sob demanda com filamento premium. Personalize com nome, data ou mensagem especial.',
    imageUrl: '',
    ctaText: 'Explorar coleção',
    ctaLink: '/produtos',
    isActive: true,
    displayDurationSeconds: 5,
  },
]

interface BannerProps {
  banners?: Banner[]
}

export default function Banner({ banners = defaultBanners }: BannerProps) {
  const activeBanners = banners.filter(b => b.isActive)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index > activeBanners.length - 1) {
      setIndex(0)
    }
  }, [activeBanners.length, index])

  const current = activeBanners[index] || activeBanners[0]
  const duration = Math.max(2, current?.displayDurationSeconds || 5) * 1000

  useEffect(() => {
    if (activeBanners.length <= 1) return
    const timer = window.setTimeout(() => {
      setIndex(prev => (prev + 1) % activeBanners.length)
    }, duration)
    return () => window.clearTimeout(timer)
  }, [index, activeBanners.length, duration])

  if (!current) return null

  const hasImage = Boolean(current.imageUrl)

  function goPrev() {
    setIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length)
  }

  function goNext() {
    setIndex(prev => (prev + 1) % activeBanners.length)
  }

  return (
    <section
      aria-roledescription="carousel"
      style={{
        position: 'relative',
        minHeight: 'clamp(420px, 56vh, 560px)',
        marginBottom: '64px',
        borderRadius: '18px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1D2235 0%, #2E3650 64%, #1A2840 100%)',
      }}
    >
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={current.imageUrl}
          alt={current.title}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: hasImage
            ? 'linear-gradient(90deg, rgba(15,18,32,0.78) 0%, rgba(15,18,32,0.55) 45%, rgba(15,18,32,0.18) 75%, rgba(15,18,32,0) 100%)'
            : 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: hasImage ? undefined : '48px 48px',
        }}
      />

      <div
        style={{
          position: 'relative',
          minHeight: 'inherit',
          display: 'flex',
          alignItems: 'center',
          padding: 'clamp(32px, 6vw, 96px) clamp(24px, 6vw, 96px)',
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ marginBottom: '18px' }}>
            <BrandLogo dark={false} size="md" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '28px', height: '1.5px', background: '#BBCFEB', borderRadius: '999px' }} />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#BBCFEB',
              }}
            >
              Impressão 3D com alma
            </span>
          </div>
          <h1
            style={{
              fontSize: 'clamp(40px, 5vw, 68px)',
              fontWeight: 700,
              color: '#F0F5FB',
              marginBottom: '18px',
              lineHeight: 1.08,
              letterSpacing: 0,
              textShadow: hasImage ? '0 2px 24px rgba(0,0,0,0.45)' : 'none',
            }}
          >
            {current.title}
          </h1>
          {current.subtitle && (
            <p
              style={{
                fontSize: '17px',
                color: 'rgba(240,245,251,0.85)',
                marginBottom: '28px',
                maxWidth: '520px',
                lineHeight: 1.7,
                textShadow: hasImage ? '0 1px 12px rgba(0,0,0,0.35)' : 'none',
              }}
            >
              {current.subtitle}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {current.ctaText && current.ctaLink && (
              <Link href={current.ctaLink}>
                <button
                  style={{
                    padding: '14px 28px',
                    backgroundColor: '#BBCFEB',
                    color: '#1D2235',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: 'fit-content',
                  }}
                >
                  {current.ctaText}
                </button>
              </Link>
            )}
            <Link href="/personalizados">
              <button
                style={{
                  padding: '14px 24px',
                  backgroundColor: 'transparent',
                  color: 'rgba(240,245,251,0.92)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: 'fit-content',
                }}
              >
                Personalizar
              </button>
            </Link>
          </div>
        </div>
      </div>

      {activeBanners.length > 1 && (
        <>
          <button type="button" aria-label="Banner anterior" onClick={goPrev} style={arrowStyle('left')}>
            <ArrowIcon direction="left" />
          </button>
          <button type="button" aria-label="Próximo banner" onClick={goNext} style={arrowStyle('right')}>
            <ArrowIcon direction="right" />
          </button>
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '8px',
              zIndex: 2,
            }}
          >
            {activeBanners.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                aria-label={`Ir para banner ${dotIndex + 1}`}
                onClick={() => setIndex(dotIndex)}
                style={{
                  width: dotIndex === index ? '28px' : '10px',
                  height: '10px',
                  borderRadius: '999px',
                  border: 'none',
                  background: dotIndex === index ? '#BBCFEB' : 'rgba(240,245,251,0.45)',
                  cursor: 'pointer',
                  transition: 'width 0.25s ease',
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: '20px',
    transform: 'translateY(-50%)',
    width: '48px',
    height: '48px',
    borderRadius: '999px',
    border: 'none',
    background: 'rgba(15,18,32,0.55)',
    color: '#F0F5FB',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backdropFilter: 'blur(6px)',
  }
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {direction === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  )
}

export { defaultBanners }
