'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface Category {
  slug: string
  name: string
}

interface ProductFilterProps {
  categories: Category[]
  selectedCategory: string | null
}

export default function ProductFilter({ categories, selectedCategory }: ProductFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleCategoryClick = useCallback((categorySlug: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (categorySlug) {
      params.set('categoria', categorySlug)
    } else {
      params.delete('categoria')
    }
    router.push(`/produtos?${params.toString()}`)
  }, [router, searchParams])

  return (
    <div className="product-filter" style={{ marginBottom: '32px' }}>
      <div
        className="product-filter-track"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollSnapType: 'x proximity',
          paddingBottom: '4px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => handleCategoryClick(null)}
          style={chipStyle(selectedCategory === null)}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => handleCategoryClick(cat.slug)}
            style={chipStyle(selectedCategory === cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <style>{`
        .product-filter-track::-webkit-scrollbar { display: none; }
        @media (min-width: 1024px) {
          .product-filter-track { flex-wrap: wrap; overflow-x: visible; }
        }
      `}</style>
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: '999px',
    border: '1px solid #E8E2DA',
    backgroundColor: active ? '#1C1917' : 'white',
    color: active ? 'white' : '#1C1917',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    scrollSnapAlign: 'start',
    whiteSpace: 'nowrap',
  }
}