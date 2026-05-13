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
        role="tablist"
        aria-label="Filtrar por categoria"
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
          aria-pressed={selectedCategory === null}
          className="ui-chip"
          style={chipStyle(selectedCategory === null)}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => handleCategoryClick(cat.slug)}
            aria-pressed={selectedCategory === cat.slug}
            className="ui-chip"
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
    border: '1px solid #D8DCE8',
    backgroundColor: active ? '#1D2235' : 'white',
    color: active ? 'white' : '#1D2235',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
    flexShrink: 0,
    scrollSnapAlign: 'start',
    whiteSpace: 'nowrap',
  }
}