'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import Input from '@/components/Input'

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

export default function EditarBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [banners, setBanners] = useState<Banner[]>(mockBanners)
  const banner = banners.find(b => b.id === id)

  const [formData, setFormData] = useState({
    title: banner?.title || '',
    subtitle: banner?.subtitle || '',
    imageUrl: banner?.imageUrl || '',
    ctaText: banner?.ctaText || '',
    ctaLink: banner?.ctaLink || '',
    isActive: banner?.isActive ?? true,
  })
  const [previewError, setPreviewError] = useState(false)

  if (!banner) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Banner não encontrado</h1>
        <Link href="/admin/banners">
          <Button>Voltar aos banners</Button>
        </Link>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setBanners(prev => prev.map(b => b.id === id ? { ...formData, id } : b))
    alert('Banner atualizado com sucesso!')
    router.push('/admin/banners')
  }

  const handleImageError = () => {
    setPreviewError(true)
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link 
          href="/admin/banners" 
          style={{ color: '#78716C', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          ← Voltar aos banners
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Editar Banner</h1>
          <p style={{ color: '#78716C', marginBottom: '32px' }}>Altere os dados do banner</p>

          <form onSubmit={handleSubmit}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input
                  label="Título do Banner"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Presentes Personalizados"
                  required
                />

                <Input
                  label="Subtítulo"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Ex: Impressos em 3D com muito carinho"
                />

                <Input
                  label="URL da Imagem"
                  value={formData.imageUrl}
                  onChange={(e) => { setFormData({ ...formData, imageUrl: e.target.value }); setPreviewError(false) }}
                  placeholder="https://exemplo.com/imagem.jpg"
                  required
                />

                <Input
                  label="Texto do Botão (CTA)"
                  value={formData.ctaText}
                  onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                  placeholder="Ex: Personalizar Agora"
                />

                <Input
                  label="Link do Botão"
                  value={formData.ctaLink}
                  onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                  placeholder="/personalizados"
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#F5F2EE', borderRadius: '8px' }}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isActive" style={{ fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                    Banner ativo (será exibido na homepage)
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                <Button type="submit" style={{ flex: 1 }}>Salvar Alterações</Button>
                <Link href="/admin/banners">
                  <Button type="button" variant="outline" style={{ flex: 1 }}>Cancelar</Button>
                </Link>
              </div>
            </div>
          </form>
        </div>

        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Preview</h2>
          <div style={{ 
            position: 'relative', 
            height: '300px', 
            borderRadius: '12px', 
            overflow: 'hidden',
            backgroundColor: '#E8E2DA',
            border: '1px solid #E8E2DA'
          }}>
            {formData.imageUrl && !previewError ? (
              <>
                <img 
                  src={formData.imageUrl} 
                  alt="Preview" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={handleImageError}
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
                  padding: '0 24px',
                }}>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: '8px',
                  }}>
                    {formData.title || 'Título do banner'}
                  </h3>
                  {formData.subtitle && (
                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', marginBottom: '16px' }}>
                      {formData.subtitle}
                    </p>
                  )}
                  {formData.ctaText && (
                    <button style={{
                      padding: '10px 20px',
                      backgroundColor: '#C8552A',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      width: 'fit-content',
                    }}>
                      {formData.ctaText}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#78716C' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', marginBottom: '8px' }}>Adicione uma URL de imagem para ver o preview</p>
                  <p style={{ fontSize: '12px' }}>Tamanho recomendado: 1200x600px</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}