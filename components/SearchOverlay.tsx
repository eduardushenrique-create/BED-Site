'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SafeImage from './SafeImage'

interface SearchProduct {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  isPersonalizable: boolean
  images: { id: string; url: string; alt: string | null }[]
  variants: { id: string; name: string }[]
}

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchedQuery, setSearchedQuery] = useState('')

  // Autofocus when opening
  useEffect(() => {
    if (isOpen) {
      // small timeout to ensure the input exists when triggered
      const id = window.setTimeout(() => {
        inputRef.current?.focus()
      }, 30)
      return () => window.clearTimeout(id)
    } else {
      setQuery('')
      setResults([])
      setError(null)
      setSearchedQuery('')
      setLoading(false)
    }
  }, [isOpen])

  // ESC + click outside
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Debounced fetch
  useEffect(() => {
    if (!isOpen) return
    const trimmed = query.trim()

    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      setSearchedQuery('')
      return
    }

    setLoading(true)
    setError(null)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error('Falha na busca')
        }
        const data = await res.json()
        const list: SearchProduct[] = Array.isArray(data) ? data.slice(0, 6) : []
        setResults(list)
        setSearchedQuery(trimmed)
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setError('Não foi possível buscar agora. Tente novamente.')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [query, isOpen])

  function goToFullResults() {
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    router.push(`/produtos?busca=${encodeURIComponent(trimmed)}`)
    onClose()
  }

  function selectSuggestion(slug: string) {
    router.push(`/produtos/${slug}`)
    onClose()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      goToFullResults()
    }
  }

  if (!isOpen) return null

  const trimmed = query.trim()
  const showEmpty = !loading && !error && trimmed.length >= 2 && results.length === 0 && searchedQuery === trimmed

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(29,34,53,0.45)',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Busca de produtos"
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          backgroundColor: 'white',
          borderBottom: '1px solid #D8DCE8',
          boxShadow: '0 12px 30px rgba(29,34,53,0.12)',
        }}
      >
        <div
          className="container"
          style={{
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#F0F5FB',
              border: '1px solid #D8DCE8',
              borderRadius: '12px',
              padding: '10px 14px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7494" strokeWidth="1.7" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="O que você procura?"
              aria-label="Buscar produtos"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '15px',
                color: '#1D2235',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar busca"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                color: '#3D4460',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>

          {trimmed.length > 0 && trimmed.length < 2 && (
            <div style={{ fontSize: '13px', color: '#6B7494', padding: '4px 4px 0' }}>
              Digite ao menos 2 caracteres para buscar.
            </div>
          )}

          {trimmed.length >= 2 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {loading && (
                <div style={{ padding: '16px 4px', color: '#6B7494', fontSize: '14px' }}>
                  Buscando...
                </div>
              )}

              {!loading && error && (
                <div style={{ padding: '16px 4px', color: '#A3526A', fontSize: '14px' }}>
                  {error}
                </div>
              )}

              {!loading && !error && results.length > 0 && (
                <>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {results.map(product => {
                      const mainImage = product.images?.[0]
                      return (
                        <li key={product.id}>
                          <button
                            type="button"
                            onClick={() => selectSuggestion(product.slug)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              background: 'white',
                              border: '1px solid #EEF1F8',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background-color var(--transition-fast)',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#F0F5FB'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'white'
                            }}
                          >
                            <div
                              style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                backgroundColor: '#E4EDF8',
                                flexShrink: 0,
                              }}
                            >
                              <SafeImage
                                src={mainImage?.url}
                                alt={mainImage?.alt || product.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: '#1D2235',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {product.name}
                              </div>
                              <div
                                style={{
                                  fontSize: '13px',
                                  color: '#6B7494',
                                  fontFamily: 'var(--font-mono)',
                                  marginTop: '2px',
                                }}
                              >
                                R$ {product.price.toFixed(2).replace('.', ',')}
                              </div>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BBCFEB" strokeWidth="2" aria-hidden="true">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </li>
                      )
                    })}
                  </ul>

                  <button
                    type="button"
                    onClick={goToFullResults}
                    style={{
                      marginTop: '4px',
                      padding: '12px',
                      background: '#1D2235',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Ver todos os resultados para “{trimmed}”
                  </button>
                </>
              )}

              {showEmpty && (
                <div
                  style={{
                    padding: '20px 12px',
                    color: '#6B7494',
                    fontSize: '14px',
                    textAlign: 'center',
                    border: '1px dashed #D8DCE8',
                    borderRadius: '10px',
                  }}
                >
                  Nada encontrado para “{trimmed}”.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
