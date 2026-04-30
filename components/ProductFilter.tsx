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
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleCategoryClick(null)}
          style={{
            padding: '8px 16px',
            borderRadius: '999px',
            border: '1px solid #E8E2DA',
            backgroundColor: selectedCategory === null ? '#1C1917' : 'white',
            color: selectedCategory === null ? 'white' : '#1C1917',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
          }}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat.slug}
            onClick={() => handleCategoryClick(cat.slug)}
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              border: '1px solid #E8E2DA',
              backgroundColor: selectedCategory === cat.slug ? '#1C1917' : 'white',
              color: selectedCategory === cat.slug ? 'white' : '#1C1917',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}