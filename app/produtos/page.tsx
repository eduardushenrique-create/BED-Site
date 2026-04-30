'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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

const categories = [
  { slug: 'decoracao', name: 'Decoração' },
  { slug: 'cozinha', name: 'Cozinha' },
  { slug: 'escritorio', name: 'Escritório' },
  { slug: 'infantil', name: 'Infantil' },
  { slug: 'pets', name: 'Pets' },
  { slug: 'casamento', name: 'Casamento' },
  { slug: 'aniversario', name: 'Aniversário' },
]

function ProductsContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('categoria')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam)

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedCategory) {
          params.set('category', selectedCategory)
        }
        
        const res = await fetch(`/api/products?${params.toString()}`)
        const data = await res.json()
        setProducts(data)
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [selectedCategory])

  return (
    <>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              border: '1px solid #E8E2DA',
              backgroundColor: selectedCategory === null ? '#1C1917' : 'white',
              color: selectedCategory === null ? 'white' : '#1C1917',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: '1px solid #E8E2DA',
                backgroundColor: selectedCategory === cat.slug ? '#1C1917' : 'white',
                color: selectedCategory === cat.slug ? 'white' : '#1C1917',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#78716C' }}>
          Carregando produtos...
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ color: '#78716C', marginBottom: '16px' }}>
            Nenhum produto encontrado.
          </p>
          <p style={{ color: '#78716C' }}>
            Tente outro filtro ou volte mais tarde.
          </p>
        </div>
      ) : (
        <div style={{
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
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px' }}>
        Nossos produtos
      </h1>

      <Suspense fallback={<div style={{ textAlign: 'center', padding: '64px 0', color: '#78716C' }}>Carregando...</div>}>
        <ProductsContent />
      </Suspense>
    </main>
  )
}