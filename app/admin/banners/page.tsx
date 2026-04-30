'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/Button'

type Banner = {
  id: string
  title: string
  subtitle: string
  imageUrl: string
  ctaText: string
  ctaLink: string
  isActive: boolean
}

const mockBanners: Banner[] = [
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

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>(mockBanners)

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este banner?')) {
      setBanners(prev => prev.filter(b => b.id !== id))
    }
  }

  const handleToggleActive = (id: string) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b))
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Banners</h1>
          <p style={{ color: '#78716C' }}>Gerencie os banners da homepage</p>
        </div>
        <Link href="/admin/banners/novo">
          <Button>+ Novo Banner</Button>
        </Link>
      </header>

      {banners.length === 0 ? (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          padding: '48px', 
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)' 
        }}>
          <p style={{ fontSize: '18px', color: '#78716C', marginBottom: '24px' }}>
            Nenhum banner encontrado
          </p>
          <Link href="/admin/banners/novo">
            <Button>Criar primeiro banner</Button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
          {banners.map(banner => (
            <div 
              key={banner.id} 
              style={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                opacity: banner.isActive ? 1 : 0.6,
              }}
            >
              <div style={{ position: 'relative', height: '180px' }}>
                <img 
                  src={banner.imageUrl} 
                  alt={banner.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Imagem' }}
                />
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: banner.isActive ? '#10B981' : '#6B7280',
                  color: 'white',
                }}>
                  {banner.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{banner.title}</h3>
                {banner.subtitle && (
                  <p style={{ fontSize: '14px', color: '#78716C', marginBottom: '12px' }}>
                    {banner.subtitle}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#78716C', marginBottom: '16px' }}>
                  <span>CTA: {banner.ctaText || 'Nenhum'}</span>
                  <span>|</span>
                  <span>Link: {banner.ctaLink || 'Nenhum'}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => handleToggleActive(banner.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #E8E2DA',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {banner.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <Link 
                    href={`/admin/banners/${banner.id}/editar`}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #E8E2DA',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    Editar
                  </Link>
                  <button 
                    onClick={() => handleDelete(banner.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #EF4444',
                      backgroundColor: 'white',
                      color: '#EF4444',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}