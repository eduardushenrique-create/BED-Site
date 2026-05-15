'use client'

/**
 * SPEC-007 §3.1.3 — combobox de busca por componente cadastrado + qty.
 *
 * Chama GET /api/componentes?search=… para listar componentes ativos.
 * Ao selecionar, adiciona à lista de componentes do orçamento.
 *
 * Componente controlado: recebe a lista atual e funções de mutação do pai.
 */

import { useEffect, useRef, useState } from 'react'

export type EstimateComponent = {
  componentId: string | null
  name: string
  unit: string
  qty: number
  /** Custo unitário no momento da adição (snapshot). */
  unitCostSnapshot: number
}

type ComponentOption = {
  id: string
  name: string
  unit: string
  costPerUnit: number
  stock: number
}

type Props = {
  components: EstimateComponent[]
  onChange: (next: EstimateComponent[]) => void
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  backgroundColor: 'white',
  color: '#1D2235',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1D2235',
  marginBottom: '6px',
}

export default function ComponentSelector({ components, onChange }: Props) {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<ComponentOption[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [fetching, setFetching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!search.trim()) {
      setOptions([])
      setDropdownOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setFetching(true)
      try {
        const res = await fetch(
          `/api/componentes?search=${encodeURIComponent(search)}&pageSize=20`,
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const data = await res.json()
        const items: ComponentOption[] = (data.items ?? data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          unit: c.unit,
          costPerUnit: Number(c.costPerUnit),
          stock: c.stock ?? 0,
        }))
        setOptions(items)
        setDropdownOpen(items.length > 0)
      } catch {
        // silencioso — componentes são opcionais
      } finally {
        setFetching(false)
      }
    }, 250)
  }, [search])

  function select(opt: ComponentOption) {
    // Evita duplicatas — se já existe o mesmo componentId, incrementa qty
    const idx = components.findIndex(c => c.componentId === opt.id)
    if (idx >= 0) {
      const next = [...components]
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
      onChange(next)
    } else {
      onChange([
        ...components,
        {
          componentId: opt.id,
          name: opt.name,
          unit: opt.unit,
          qty: 1,
          unitCostSnapshot: opt.costPerUnit,
        },
      ])
    }
    setSearch('')
    setDropdownOpen(false)
  }

  function updateQty(idx: number, qty: number) {
    const next = [...components]
    next[idx] = { ...next[idx], qty }
    onChange(next)
  }

  function remove(idx: number) {
    onChange(components.filter((_, i) => i !== idx))
  }

  return (
    <div>
      {/* Buscador */}
      <div ref={containerRef} style={{ position: 'relative', marginBottom: '12px' }}>
        <label htmlFor="component-search" style={LABEL_STYLE}>
          Buscar componente
        </label>
        <input
          id="component-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => options.length > 0 && setDropdownOpen(true)}
          placeholder="Digite para buscar (LED, embalagem…)"
          autoComplete="off"
          style={{ ...INPUT_STYLE, width: '100%' }}
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          aria-controls="component-dropdown"
        />
        {fetching && (
          <span
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%) translateY(10px)',
              fontSize: '12px',
              color: '#6B7494',
            }}
          >
            …
          </span>
        )}

        {dropdownOpen && options.length > 0 && (
          <ul
            id="component-dropdown"
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: 'white',
              border: '1px solid #D8DCE8',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              listStyle: 'none',
              padding: '4px 0',
              zIndex: 50,
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            {options.map(opt => (
              <li key={opt.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => select(opt)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: '#1D2235',
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F0F5FB'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = ''
                  }}
                >
                  <span>{opt.name}</span>
                  <span style={{ color: '#6B7494', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                    R$ {opt.costPerUnit.toFixed(2).replace('.', ',')} / {opt.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lista de componentes selecionados */}
      {components.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {components.map((c, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: '#F9FBFD',
                borderRadius: '8px',
                border: '1px solid #EEF1F8',
              }}
            >
              <span
                style={{ flex: 1, fontSize: '14px', color: '#1D2235', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={c.name}
              >
                {c.name}
              </span>
              <span style={{ fontSize: '12px', color: '#6B7494', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                R$ {c.unitCostSnapshot.toFixed(2).replace('.', ',')}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6B7494' }}>Qtd</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={c.qty}
                  onChange={e => {
                    const v = Number(e.target.value)
                    if (v > 0) updateQty(idx, v)
                  }}
                  style={{
                    ...INPUT_STYLE,
                    width: '60px',
                    padding: '6px 8px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                  aria-label={`Quantidade de ${c.name}`}
                />
              </label>
              <span style={{ fontSize: '12px', color: '#9AA2B8', fontFamily: 'var(--font-mono)' }}>
                = R$ {(c.qty * c.unitCostSnapshot).toFixed(2).replace('.', ',')}
              </span>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label={`Remover ${c.name}`}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid #FCA5A5',
                  backgroundColor: 'white',
                  color: '#B42318',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {components.length === 0 && (
        <p style={{ fontSize: '13px', color: '#9AA2B8', margin: 0 }}>
          Nenhum componente adicionado.
        </p>
      )}
    </div>
  )
}
