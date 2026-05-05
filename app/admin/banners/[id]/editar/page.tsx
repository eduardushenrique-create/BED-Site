'use client'

import { useEffect, useState, use } from 'react'
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
  displayDurationSeconds: number
}

const emptyForm: Omit<Banner, 'id'> = {
  title: '',
  subtitle: '',
  imageUrl: '',
  ctaText: '',
  ctaLink: '',
  isActive: true,
  displayDurationSeconds: 5,
}

export default function EditarBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Omit<Banner, 'id'>>(emptyForm)
  const [previewError, setPreviewError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/banners')
        if (!res.ok) {
          if (!cancelled) setNotFound(true)
          return
        }
        const data: Banner[] = await res.json()
        const banner = Array.isArray(data) ? data.find(b => b.id === id) : null
        if (!banner) {
          if (!cancelled) setNotFound(true)
          return
        }
        if (!cancelled) {
          setFormData({
            title: banner.title || '',
            subtitle: banner.subtitle || '',
            imageUrl: banner.imageUrl || '',
            ctaText: banner.ctaText || '',
            ctaLink: banner.ctaLink || '',
            isActive: banner.isActive,
            displayDurationSeconds: banner.displayDurationSeconds || 5,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>
  }

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Banner não encontrado</h1>
        <Link href="/admin/banners">
          <Button>Voltar aos banners</Button>
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/banners', {
        method: 'PUT',
        body: JSON.stringify({ id, ...formData }),
      })
      if (!res.ok) {
        alert('Erro ao salvar banner')
        return
      }
      router.push('/admin/banners')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/banners" style={{ color: '#6B7494', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          ← Voltar aos banners
        </Link>
      </div>

      <div className="admin-detail-grid" style={{ gap: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Editar Banner</h1>
          <p style={{ color: '#6B7494', marginBottom: '32px' }}>Altere os dados do banner</p>

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

                <Input
                  label="Tempo de exibição no carrossel (segundos)"
                  type="number"
                  min={2}
                  max={60}
                  value={String(formData.displayDurationSeconds)}
                  onChange={(e) => setFormData({ ...formData, displayDurationSeconds: Math.max(2, parseInt(e.target.value, 10) || 5) })}
                  placeholder="5"
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#F0F5FB', borderRadius: '8px' }}>
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
                <Button type="submit" disabled={saving} style={{ flex: 1 }}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
                <Link href="/admin/banners">
                  <Button type="button" variant="outline" style={{ flex: 1 }}>Cancelar</Button>
                </Link>
              </div>
            </div>
          </form>
        </div>

        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Preview</h2>
          <div style={{ position: 'relative', height: '300px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#D8DCE8', border: '1px solid #D8DCE8' }}>
            {formData.imageUrl && !previewError ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={formData.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setPreviewError(true)} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)' }} />
                <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{formData.title || 'Título do banner'}</h3>
                  {formData.subtitle && (
                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', marginBottom: '16px' }}>{formData.subtitle}</p>
                  )}
                  {formData.ctaText && (
                    <button type="button" style={{ padding: '10px 20px', backgroundColor: '#D4849A', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, width: 'fit-content' }}>
                      {formData.ctaText}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7494' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', marginBottom: '8px' }}>Adicione uma URL de imagem para ver o preview</p>
                  <p style={{ fontSize: '12px' }}>Tamanho recomendado: 1920x600px</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
