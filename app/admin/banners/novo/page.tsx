'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import Input from '@/components/Input'

export default function NovoBannerPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    htmlContent: '',
    isActive: true,
    displayDurationSeconds: 5,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.htmlContent) {
      alert('Preencha o título e o HTML do banner')
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

      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Novo Banner</h1>
      <p style={{ color: '#6B7494', marginBottom: '32px' }}>Crie um novo banner para a homepage</p>

      <form onSubmit={handleSubmit}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Input
              label="Título do Banner"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Label administrativo — não aparece no site"
              required
            />

            <div>
              <label
                htmlFor="htmlContent"
                style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}
              >
                HTML do Banner
              </label>
              <textarea
                id="htmlContent"
                value={formData.htmlContent}
                onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                rows={18}
                spellCheck={false}
                placeholder='<div style="width:100%;height:100%;background:#1D2235;color:#fff;display:flex;align-items:center;justify-content:center;">Seu banner aqui</div>'
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  padding: '12px',
                  border: '1px solid #D8DCE8',
                  borderRadius: '8px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.5,
                }}
                required
              />
            </div>

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
            <Button type="submit" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Salvando...' : 'Criar Banner'}
            </Button>
            <Link href="/admin/banners">
              <Button type="button" variant="outline" style={{ flex: 1 }}>Cancelar</Button>
            </Link>
          </div>
        </div>
      </form>

      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Preview</h2>
        {formData.htmlContent ? (
          <iframe
            srcDoc={formData.htmlContent}
            sandbox="allow-scripts"
            title="Preview do banner"
            style={{
              width: '100%',
              height: '400px',
              border: 'none',
              borderRadius: '8px',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '400px',
            borderRadius: '8px',
            backgroundColor: '#F0F5FB',
            border: '1px dashed #D8DCE8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6B7494',
            fontSize: '14px',
          }}>
            Digite o HTML do banner para ver o preview
          </div>
        )}
      </div>
    </div>
  )
}
