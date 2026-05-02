'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/context/WishlistContext'
import SafeImage from '@/components/SafeImage'

type WishlistApiItem = {
  id: string
  productId: string
  createdAt: string
  product: {
    id: string
    name: string
    slug: string
    price: number
    imageUrl?: string
    isActive: boolean
    stock: number
    underOrder: boolean
  } | null
}

export default function FavoritosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { remove, refresh } = useWishlist()
  const [items, setItems] = useState<WishlistApiItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?redirect=/minha-conta/favoritos')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/me/wishlist', { cache: 'no-store' })
        if (!res.ok) {
          setItems([])
          return
        }
        const data: WishlistApiItem[] = await res.json()
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleRemove(productId: string) {
    setItems(prev => prev.filter(item => item.productId !== productId))
    const ok = await remove(productId)
    if (!ok) {
      // revert: refetch on failure
      const res = await fetch('/api/me/wishlist', { cache: 'no-store' })
      if (res.ok) setItems(await res.json())
      await refresh()
    }
  }

  if (authLoading || !user) {
    return <main className="container" style={{ paddingTop: '112px', textAlign: 'center', color: '#6B7494' }}>Carregando...</main>
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/minha-conta" style={{ color: '#6B7494', textDecoration: 'none' }}>← Minha conta</Link>
      </div>
      <div style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Favoritos</p>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: '#1D2235', margin: '8px 0 4px' }}>Seus produtos salvos</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>Tudo que você marcou como favorito fica aqui.</p>
      </div>

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando favoritos...</p>
      ) : items.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#6B7494', marginBottom: '20px' }}>Você ainda não favoritou nenhum produto.</p>
          <Link href="/produtos" style={{ display: 'inline-block', padding: '12px 24px', background: '#1D2235', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
          {items.map(item => {
            const product = item.product
            if (!product) {
              return (
                <div key={item.id} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <p style={{ color: '#6B7494', marginBottom: '12px' }}>Produto removido do catálogo.</p>
                  <button onClick={() => handleRemove(item.productId)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer' }}>
                    Remover
                  </button>
                </div>
              )
            }
            const unavailable = !product.isActive || (product.stock <= 0 && !product.underOrder)
            return (
              <article key={item.id} style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(29,34,53,0.07)' }}>
                <Link href={`/produtos/${product.slug}`} style={{ display: 'block', aspectRatio: '4/3', background: '#E4EDF8' }}>
                  <SafeImage src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Link>
                <div style={{ padding: '16px' }}>
                  <Link href={`/produtos/${product.slug}`} style={{ textDecoration: 'none', color: '#1D2235' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.3 }}>{product.name}</h3>
                  </Link>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: '#1D2235', margin: '0 0 12px' }}>
                    R$ {Number(product.price).toFixed(2).replace('.', ',')}
                  </p>
                  {unavailable && (
                    <p style={{ fontSize: '13px', color: '#A3526A', margin: '0 0 12px' }}>Indisponível no momento</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      href={`/produtos/${product.slug}`}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: '#1D2235', color: 'white', textDecoration: 'none', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}
                    >
                      Ver produto
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemove(product.id)}
                      aria-label="Remover dos favoritos"
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', color: '#A3526A', fontSize: '13px', fontWeight: 600 }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
