'use client'

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
  },
]

interface BannerProps {
  banners?: Banner[]
}

export default function Banner({ banners = defaultBanners }: BannerProps) {
  const activeBanner = banners.find(b => b.isActive)

  if (!activeBanner) return null

  const hasImage = Boolean(activeBanner.imageUrl)

  return (
    <section
      style={{
        position: 'relative',
        minHeight: 'clamp(480px, 72vh, 620px)',
        marginBottom: '64px',
        borderRadius: '18px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1D2235 0%, #2E3650 64%, #1A2840 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '8%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'min(42vw, 420px)',
          height: 'min(42vw, 420px)',
          background: 'radial-gradient(ellipse, rgba(187,207,235,0.14) 0%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          minHeight: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '32px',
          padding: 'clamp(32px, 6vw, 80px) clamp(24px, 5vw, 64px)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: '540px', position: 'relative', zIndex: 1 }}>
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
            }}
          >
            {activeBanner.title}
          </h1>
          {activeBanner.subtitle && (
            <p
              style={{
                fontSize: '17px',
                color: 'rgba(240,245,251,0.7)',
                marginBottom: '28px',
                maxWidth: '460px',
                lineHeight: 1.7,
              }}
            >
              {activeBanner.subtitle}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {activeBanner.ctaText && activeBanner.ctaLink && (
              <Link href={activeBanner.ctaLink}>
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
                  {activeBanner.ctaText}
                </button>
              </Link>
            )}
            <Link href="/personalizados">
              <button
                style={{
                  padding: '14px 24px',
                  backgroundColor: 'transparent',
                  color: 'rgba(240,245,251,0.84)',
                  border: '1px solid rgba(255,255,255,0.18)',
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

        <div
          style={{
            flex: '0 0 min(34vw, 320px)',
            width: 'min(34vw, 320px)',
            minWidth: '220px',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeBanner.imageUrl}
              alt={activeBanner.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '14px',
                boxShadow: '0 32px 64px rgba(29,34,53,0.35)',
              }}
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 280 280"
              fill="none"
              width="100%"
              height="100%"
              style={{ filter: 'drop-shadow(0 32px 64px rgba(29,34,53,0.35))' }}
              aria-hidden="true"
            >
              <polygon points="140,28 236,80 140,132 44,80" fill="#BBCFEB" />
              <polygon points="44,80 140,132 140,244 44,192" fill="#1D2235" />
              <polygon points="236,80 140,132 140,244 236,192" fill="#2E3650" />
              <polyline points="44,80 140,28 236,80" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="140" y1="132" x2="140" y2="244" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <g transform="translate(198,30) scale(0.28)">
                <polygon points="80,0 160,40 80,80 0,40" fill="#BBCFEB" opacity="0.5" />
                <polygon points="0,40 80,80 80,160 0,120" fill="#1D2235" opacity="0.5" />
                <polygon points="160,40 80,80 80,160 160,120" fill="#2E3650" opacity="0.5" />
              </g>
              <g transform="translate(24,190) scale(0.18)">
                <polygon points="80,0 160,40 80,80 0,40" fill="#BBCFEB" opacity="0.35" />
                <polygon points="0,40 80,80 80,160 0,120" fill="#1D2235" opacity="0.35" />
                <polygon points="160,40 80,80 80,160 160,120" fill="#2E3650" opacity="0.35" />
              </g>
            </svg>
          )}
        </div>
      </div>
    </section>
  )
}

export { defaultBanners }
