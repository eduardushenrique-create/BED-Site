'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { compressImageToDataUrl, ImageUploadError } from '@/lib/image-upload'

export default function NovoBannerPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    ctaText: '',
    ctaLink: '',
    isActive: true,
    displayDurationSeconds: 5,
  })
  const [imagePreview, setImagePreview] = useState('')
  const [previewError, setPreviewError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [imageError, setImageError] = useState('')

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')
    setImageProcessing(true)
    try {
      const compressed = await compressImageToDataUrl(file, { maxWidth: 1920, maxHeight: 800, quality: 0.85 })
      setImagePreview(compressed)
      setFormData({ ...formData, imageUrl: compressed })
    } catch (err) {
      const msg = err instanceof ImageUploadError ? err.message : 'Erro ao processar a imagem.'
      setImageError(msg)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setImageProcessing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.imageUrl) {
      alert('Preencha o título e a imagem')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Erro ao criar banner')
        return
      }
      router.push('/admin/banners')
    } catch (e) {
      console.error('Error creating banner:', e)
      alert('Erro ao criar banner')
    } finally {
      setSaving(false)
    }
  }

  const handleImageError = () => {
    setPreviewError(true)
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link 
          href="/admin/banners" 
          style={{ color: '#6B7494', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          ← Voltar aos banners
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Novo Banner</h1>
          <p style={{ color: '#6B7494', marginBottom: '32px' }}>Crie um novo banner para a homepage</p>

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

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Imagem do Banner</label>
                  <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" disabled={imageProcessing} onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 16px', backgroundColor: '#F0F5FB', border: '1px solid #D8DCE8', borderRadius: '6px', cursor: imageProcessing ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: imageProcessing ? 0.6 : 1 }}>
                      {imageProcessing ? 'Processando...' : imagePreview ? 'Trocar imagem' : 'Selecionar imagem'}
                    </button>
                    {imagePreview && !imageProcessing && (
                      <button type="button" onClick={() => { setImagePreview(''); setFormData({ ...formData, imageUrl: '' }); setImageError('') }} style={{ padding: '10px 16px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#EF4444' }}>
                        Remover
                      </button>
                    )}
                  </div>
                  <p style={{ marginTop: '6px', fontSize: '12px', color: '#6B7494' }}>
                    JPG, PNG ou WebP até 10 MB. Será redimensionada para 1920×800.
                  </p>
                  {imageError && (
                    <p role="alert" style={{ marginTop: '6px', fontSize: '13px', color: '#A3526A', fontWeight: 600 }}>{imageError}</p>
                  )}
                  {imagePreview && (
                    <div style={{ marginTop: '12px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>

                <Input
                  label="Ou URL da imagem"
                  value={formData.imageUrl}
                  onChange={(e) => { setFormData({ ...formData, imageUrl: e.target.value }); setImagePreview(e.target.value); setPreviewError(false) }}
                  placeholder="https://exemplo.com/imagem.jpg"
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
                <Button type="submit" disabled={saving} style={{ flex: 1 }}>{saving ? 'Salvando...' : 'Criar Banner'}</Button>
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
            backgroundColor: '#D8DCE8',
            border: '1px solid #D8DCE8'
          }}>
            {(formData.imageUrl && !previewError) || imagePreview ? (
              <>
                <img 
                  src={imagePreview || formData.imageUrl} 
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
                      backgroundColor: '#D4849A',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7494' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', marginBottom: '8px' }}>Adicione uma imagem para ver o preview</p>
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
