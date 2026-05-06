'use client'

import { useEffect, useState } from 'react'

export interface Banner {
  id: string
  title: string        // label administrativo, não é exibido
  htmlContent: string  // HTML completo do banner
  isActive: boolean
  displayDurationSeconds?: number
}

const defaultBanners: Banner[] = [
  {
    id: '1',
    title: 'Banner de exemplo',
    htmlContent: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1D2235 0%,#2E3650 100%);color:#F0F5FB;font-family:sans-serif;font-size:22px;font-weight:600;">Configure seus banners no painel admin.</div>`,
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
      }}
    >
      <iframe
        key={current.id}
        srcDoc={current.htmlContent}
        sandbox="allow-scripts"
        title={current.title}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      />

      {activeBanners.length > 1 && (
        <>
          <style>{`
            @media (max-width: 640px) {
              .banner-arrow { width: 36px !important; height: 36px !important; }
              .banner-arrow-left { left: 8px !important; }
              .banner-arrow-right { right: 8px !important; }
            }
          `}</style>
          <button type="button" aria-label="Banner anterior" onClick={goPrev} className="banner-arrow banner-arrow-left" style={arrowStyle('left')}>
            <ArrowIcon direction="left" />
          </button>
          <button type="button" aria-label="Próximo banner" onClick={goNext} className="banner-arrow banner-arrow-right" style={arrowStyle('right')}>
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
