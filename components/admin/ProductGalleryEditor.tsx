'use client'

import { useEffect, useRef, useState } from 'react'
import { compressImageToDataUrl, ImageUploadError } from '@/lib/image-upload'

type ProductImage = {
  id: string
  url: string
  alt: string | null
  sortOrder: number
  isMain: boolean
}

const MAX_IMAGES = 8

export default function ProductGalleryEditor({ productId }: { productId: string }) {
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/produtos/${productId}/imagens`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setImages(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [productId])

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const compressed = await compressImageToDataUrl(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 })
      const res = await fetch(`/api/produtos/${productId}/imagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: compressed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Erro ao adicionar imagem.')
        return
      }
      await load()
    } catch (err) {
      setError(err instanceof ImageUploadError ? err.message : 'Erro ao processar a imagem.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSetMain(imageId: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/imagens/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMain: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erro ao definir como principal.')
        return
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(imageId: string) {
    if (!confirm('Remover esta imagem?')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/imagens/${imageId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erro ao remover imagem.')
        return
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= images.length) return
    const reordered = [...images]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setImages(reordered)
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/imagens`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map(i => i.id) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erro ao reordenar.')
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p style={{ color: '#6B7494', fontSize: '13px' }}>Carregando galeria...</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1D2235', margin: 0 }}>Galeria de imagens ({images.length}/{MAX_IMAGES})</h3>
        <button
          type="button"
          disabled={busy || images.length >= MAX_IMAGES}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #D8DCE8',
            background: '#F0F5FB',
            color: '#1D2235',
            fontSize: '13px',
            fontWeight: 600,
            cursor: busy || images.length >= MAX_IMAGES ? 'not-allowed' : 'pointer',
            opacity: busy || images.length >= MAX_IMAGES ? 0.6 : 1,
          }}
        >
          {busy ? 'Processando...' : '+ Adicionar imagem'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      <p style={{ marginTop: 0, marginBottom: '12px', fontSize: '12px', color: '#6B7494' }}>
        JPG, PNG ou WebP até 10 MB cada. Reordene com as setas. A imagem principal aparece destacada.
      </p>

      {error && (
        <p role="alert" style={{ marginBottom: '12px', padding: '10px 12px', background: '#F1E5E9', color: '#A3526A', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <p style={{ color: '#6B7494', fontSize: '13px', padding: '24px', background: '#F0F5FB', borderRadius: '10px', textAlign: 'center' }}>
          Nenhuma imagem adicional. Adicione fotos para mostrar o produto de vários ângulos.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {images.map((img, index) => (
            <li
              key={img.id}
              style={{
                background: 'white',
                border: img.isMain ? '2px solid #1D7A72' : '1px solid #D8DCE8',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', aspectRatio: '1', background: '#E4EDF8' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {img.isMain && (
                  <span style={{ position: 'absolute', top: '6px', left: '6px', background: '#1D7A72', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', letterSpacing: '0.04em' }}>
                    PRINCIPAL
                  </span>
                )}
              </div>
              <div style={{ padding: '8px', display: 'grid', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" aria-label="Mover para a esquerda" disabled={busy || index === 0} onClick={() => handleMove(index, -1)} style={iconBtn}>←</button>
                  <button type="button" aria-label="Mover para a direita" disabled={busy || index === images.length - 1} onClick={() => handleMove(index, 1)} style={iconBtn}>→</button>
                </div>
                {!img.isMain && (
                  <button type="button" disabled={busy} onClick={() => handleSetMain(img.id)} style={smallBtn}>
                    Definir como principal
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => handleRemove(img.id)} style={{ ...smallBtn, background: '#FCEBF0', borderColor: '#D4849A', color: '#A3526A' }}>
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  flex: 1,
  padding: '4px 0',
  fontSize: '14px',
  border: '1px solid #D8DCE8',
  background: '#F0F5FB',
  borderRadius: '6px',
  cursor: 'pointer',
  color: '#1D2235',
  fontWeight: 700,
}

const smallBtn: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: '12px',
  fontWeight: 600,
  borderRadius: '6px',
  border: '1px solid #D8DCE8',
  background: 'white',
  cursor: 'pointer',
  color: '#1D2235',
}
