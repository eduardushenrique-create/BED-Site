'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProductCard from '@/components/ProductCard'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  isPersonalizable: boolean
  images: { id: string; url: string; alt: string | null }[]
  variants: { id: string; name: string }[]
}

interface Category {
  id: string
  name: string
  slug: string
}

function ProductsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('categoria')
  const searchParam = searchParams.get('busca') || ''

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam)

  // Keep selected category in sync with URL changes (e.g. nav from header)
  useEffect(() => {
    setSelectedCategory(categoryParam)
  }, [categoryParam])

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        setCategories(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }

    fetchCategories()
  }, [])

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedCategory) {
          params.set('category', selectedCategory)
        }
        if (searchParam) {
          params.set('search', searchParam)
        }

        const res = await fetch(`/api/products?${params.toString()}`)
        const data = await res.json()
        setProducts(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [selectedCategory, searchParam])

  function clearSearch() {
    const params = new URLSearchParams()
    if (selectedCategory) {
      params.set('categoria', selectedCategory)
    }
    const qs = params.toString()
    router.push(qs ? `/produtos?${qs}` : '/produtos')
  }

  return (
    <>
      {searchParam && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            background: '#F0F5FB',
            border: '1px solid #D8DCE8',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ color: '#1D2235', fontSize: '15px' }}>
            Resultados para: <strong>“{searchParam}”</strong>
          </div>
          <button
            type="button"
            onClick={clearSearch}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #1D2235',
              background: 'white',
              color: '#1D2235',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Limpar busca
          </button>
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>
        <div role="tablist" aria-label="Filtrar por categoria" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            aria-pressed={selectedCategory === null}
            className="ui-chip"
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              border: '1px solid #D8DCE8',
              backgroundColor: selectedCategory === null ? '#1D2235' : 'white',
              color: selectedCategory === null ? 'white' : '#1D2235',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background-color var(--transition-fast), color var(--transition-fast)',
            }}
          >
            Todos
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.slug)}
              aria-pressed={selectedCategory === category.slug}
              className="ui-chip"
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: '1px solid #D8DCE8',
                backgroundColor: selectedCategory === category.slug ? '#1D2235' : 'white',
                color: selectedCategory === category.slug ? 'white' : '#1D2235',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color var(--transition-fast), color var(--transition-fast)',
              }}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: '64px 0', color: '#6B7494' }}>
          Carregando produtos…
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>
            {searchParam
              ? <>Nada encontrado para <span translate="no">“{searchParam}”</span>.</>
              : 'Nenhum produto encontrado.'}
          </p>
          <p style={{ color: '#6B7494' }}>
            {searchParam
              ? 'Tente outras palavras-chave ou remova os filtros.'
              : 'Publique produtos ativos no banco para exibi-los aqui.'}
          </p>
        </div>
      ) : (
        <div aria-busy={loading} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
        }}>
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  )
}

export default function ProductsPage() {
  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', color: '#1D2235' }}>
        Nossos produtos
      </h1>

      <Suspense fallback={<div style={{ textAlign: 'center', padding: '64px 0', color: '#6B7494' }}>Carregando…</div>}>
        <ProductsContent />
      </Suspense>
    </main>
  )
}
