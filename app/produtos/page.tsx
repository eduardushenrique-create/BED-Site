'use client'

import { Suspense, useEffect, useState } from 'react'
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

interface Category {
  id: string
  name: string
  slug: string
}

function ProductsContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('categoria')

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam)

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
              border: '1px solid #D8DCE8',
              backgroundColor: selectedCategory === null ? '#1D2235' : 'white',
              color: selectedCategory === null ? 'white' : '#1D2235',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Todos
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.slug)}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: '1px solid #D8DCE8',
                backgroundColor: selectedCategory === category.slug ? '#1D2235' : 'white',
                color: selectedCategory === category.slug ? 'white' : '#1D2235',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#6B7494' }}>
          Carregando produtos...
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>
            Nenhum produto encontrado.
          </p>
          <p style={{ color: '#6B7494' }}>
            Publique produtos ativos no banco para exibi-los aqui.
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
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', color: '#1D2235' }}>
        Nossos produtos
      </h1>

      <Suspense fallback={<div style={{ textAlign: 'center', padding: '64px 0', color: '#6B7494' }}>Carregando...</div>}>
        <ProductsContent />
      </Suspense>
    </main>
  )
}
