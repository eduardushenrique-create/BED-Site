'use client'

import Link from 'next/link'

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
    title: 'Presentes Personalizados',
    subtitle: 'Impressos em 3D com muito carinho',
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&h=600&fit=crop',
    ctaText: 'Personalizar Agora',
    ctaLink: '/personalizados',
    isActive: true,
  },
]

interface BannerProps {
  banners?: Banner[]
}

export default function Banner({ banners = defaultBanners }: BannerProps) {
  const activeBanner = banners.find(b => b.isActive)

  if (!activeBanner) return null

  return (
    <section style={{
      position: 'relative',
      height: '400px',
      marginBottom: '64px',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      <img
        src={activeBanner.imageUrl}
        alt={activeBanner.title}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)',
      }} />
      <div style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 48px',
        maxWidth: '600px',
      }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: 700,
          color: 'white',
          marginBottom: '12px',
          lineHeight: 1.2,
        }}>
          {activeBanner.title}
        </h1>
        {activeBanner.subtitle && (
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '24px',
          }}>
            {activeBanner.subtitle}
          </p>
        )}
        {activeBanner.ctaText && activeBanner.ctaLink && (
          <Link href={activeBanner.ctaLink}>
            <button style={{
              padding: '14px 28px',
              backgroundColor: '#C8552A',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              width: 'fit-content',
            }}>
              {activeBanner.ctaText}
            </button>
          </Link>
        )}
      </div>
    </section>
  )
}

export { defaultBanners }