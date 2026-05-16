'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import Input from '@/components/Input'

type Banner = {
  id: string
  title: string
  htmlContent: string
  isActive: boolean
  displayDurationSeconds: number
  displayOrder: number
}

const emptyForm: Omit<Banner, 'id'> = {
  title: '',
  htmlContent: '',
  isActive: true,
  displayDurationSeconds: 5,
  displayOrder: 0,
}

function parseLinks(html: string) {
  if (!html || typeof window === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return Array.from(doc.querySelectorAll('a[href]')).map((a, i) => ({
      index: i,
      label: (a.textContent?.trim().replace(/\s+/g, ' ') || '').slice(0, 60) || `Link ${i + 1}`,
      href: a.getAttribute('href') || '',
    }))
  } catch {
    return []
  }
}

function updateLinkHref(html: string, linkIndex: number, newHref: string): string {
  let count = 0
  return html.replace(/<a(\s[^>]*)>/gi, (match, attrs) => {
    if (!/href=/i.test(attrs)) return match
    if (count === linkIndex) {
      count++
      return `<a${attrs.replace(/href="[^"]*"/i, `href="${newHref}"`)}>`
    }
    count++
    return match
  })
}

export default function EditarBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Omit<Banner, 'id'>>(emptyForm)
  const detectedLinks = useMemo(() => parseLinks(formData.htmlContent), [formData.htmlContent])

  function handleLinkHrefChange(linkIndex: number, newHref: string) {
    setFormData(prev => ({ ...prev, htmlContent: updateLinkHref(prev.htmlContent, linkIndex, newHref) }))
  }

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
            htmlContent: banner.htmlContent || '',
            isActive: banner.isActive,
            displayDurationSeconds: banner.displayDurationSeconds || 5,
            displayOrder: banner.displayOrder ?? 0,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
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
    if (!formData.title || !formData.htmlContent) {
      alert('Preencha o título e o HTML do banner')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Editar Banner</h1>
      <p style={{ color: '#6B7494', marginBottom: '32px' }}>Altere os dados do banner</p>

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

            {detectedLinks.length > 0 && (
              <div style={{ border: '1px solid #D8DCE8', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#F0F5FB', padding: '12px 16px', borderBottom: '1px solid #D8DCE8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D2235' }}>
                    Links / botões detectados
                  </span>
                  <span style={{ fontSize: '12px', backgroundColor: '#1D2235', color: '#F0F5FB', borderRadius: '999px', padding: '1px 8px' }}>
                    {detectedLinks.length}
                  </span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#6B7494', margin: 0 }}>
                    Edite os links abaixo — o HTML é atualizado automaticamente ao sair do campo.
                  </p>
                  {detectedLinks.map((link) => (
                    <div key={`${link.index}-${detectedLinks.length}`}>
                      <span style={{ fontSize: '12px', color: '#6B7494', display: 'block', marginBottom: '4px' }}>
                        {link.label ? `"${link.label}"` : `Botão ${link.index + 1}`}
                      </span>
                      <input
                        key={`href-${link.index}-${detectedLinks.length}`}
                        type="text"
                        defaultValue={link.href}
                        onBlur={(e) => handleLinkHrefChange(link.index, e.target.value)}
                        placeholder="https://..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #D8DCE8',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box',
                          backgroundColor: 'white',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Input
              label="Tempo de exibição no carrossel (segundos)"
              type="number"
              min={2}
              max={60}
              value={String(formData.displayDurationSeconds)}
              onChange={(e) => setFormData({ ...formData, displayDurationSeconds: Math.max(2, parseInt(e.target.value, 10) || 5) })}
              placeholder="5"
            />

            <div>
              <Input
                label="Ordem de exibição"
                type="number"
                min={0}
                value={String(formData.displayOrder)}
                onChange={(e) => setFormData({ ...formData, displayOrder: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                placeholder="0"
              />
              <span style={{ fontSize: '12px', color: '#6B7494', marginTop: '4px', display: 'block' }}>
                Banners são exibidos do menor para o maior número (0 = primeiro)
              </span>
            </div>

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
              {saving ? 'Salvando...' : 'Salvar Alterações'}
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
            sandbox="allow-scripts allow-same-origin"
            title="Preview do banner"
            style={{ width: '100%', height: '560px', border: 'none', borderRadius: '8px' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '560px',
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
