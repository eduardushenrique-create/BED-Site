'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/Button'

type Banner = {
  id: string
  title: string
  htmlContent: string
  isActive: boolean
  displayDurationSeconds: number
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBanners()
  }, [])

  async function loadBanners() {
    setLoading(true)
    try {
      const res = await fetch('/api/banners')
      if (res.ok) {
        const data = await res.json()
        setBanners(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error loading banners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este banner?')) return
    try {
      await fetch(`/api/banners?id=${id}`, { method: 'DELETE' })
      loadBanners()
    } catch (error) {
      console.error('Error deleting banner:', error)
    }
  }

  const handleToggleActive = async (id: string) => {
    const banner = banners.find(b => b.id === id)
    if (!banner) return
    try {
      await fetch('/api/banners', {
        method: 'PUT',
        body: JSON.stringify({ id, isActive: !banner.isActive }),
      })
      loadBanners()
    } catch (error) {
      console.error('Error toggling banner:', error)
    }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Banners</h1>
          <p style={{ color: '#6B7494' }}>Gerencie os banners da homepage</p>
        </div>
        <Link href="/admin/banners/novo">
          <Button variant="blue">+ Novo Banner</Button>
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
          <p style={{ fontSize: '18px', color: '#6B7494', marginBottom: '24px' }}>
            Nenhum banner encontrado
          </p>
          <Link href="/admin/banners/novo">
            <Button variant="blue">Criar primeiro banner</Button>
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
              <div style={{ position: 'relative', height: '180px', backgroundColor: '#1D2235', overflow: 'hidden' }}>
                <iframe
                  srcDoc={banner.htmlContent || '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1D2235;color:#BBCFEB;font-family:sans-serif;font-size:13px;opacity:0.7;">Sem conteúdo HTML</div>'}
                  sandbox="allow-scripts"
                  title={`Preview: ${banner.title}`}
                  style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
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
                <div style={{ fontSize: '13px', color: '#6B7494', marginBottom: '16px' }}>
                  Tempo no carrossel: {banner.displayDurationSeconds || 5}s
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleToggleActive(banner.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #D8DCE8',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#1D2235',
                    }}
                  >
                    {banner.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <Link
                    href={`/admin/banners/${banner.id}/editar`}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #D8DCE8',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textDecoration: 'none',
                      color: '#1D2235',
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
