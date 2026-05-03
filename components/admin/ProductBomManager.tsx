'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type BomEntry = {
  id: string
  productId: string
  variantId: string | null
  variantName: string | null
  componentId: string
  componentName: string
  componentSku: string | null
  componentUnit: string
  componentStock: number
  componentLowThreshold: number | null
  quantityPerUnit: number
  notes: string | null
  coverageUnits: number
}

type Coverage = {
  maxProducible: number | null
  entries: BomEntry[]
}

type Component = {
  id: string
  sku: string | null
  name: string
  unit: string
  stock: number
  isActive: boolean
}

type Variant = { id: string; name: string }

interface Props {
  productId: string
  variants?: Variant[]
}

function formatNumber(n: number, unit: string): string {
  const decimals = ['kg', 'g', 'L', 'ml', 'm'].includes(unit) ? 3 : 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

export default function ProductBomManager({ productId, variants = [] }: Props) {
  const [entries, setEntries] = useState<BomEntry[]>([])
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  // Form para novo vínculo
  const [newCompId, setNewCompId] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newVariantId, setNewVariantId] = useState<string>('') // '' = global
  const [newNotes, setNewNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bomRes, compRes] = await Promise.all([
        fetch(`/api/produtos/${productId}/componentes`, { cache: 'no-store' }),
        fetch('/api/componentes?onlyActive=1', { cache: 'no-store' }),
      ])
      if (!bomRes.ok) {
        setError('Erro ao carregar BOM.')
        return
      }
      const bomData = await bomRes.json()
      setEntries(bomData.entries || [])
      setCoverage(bomData.coverage || null)
      if (compRes.ok) {
        const compData = await compRes.json()
        setComponents(Array.isArray(compData.components) ? compData.components : [])
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd() {
    if (!newCompId || !newQty) return
    setSaving(true)
    setError('')
    setFeedback(null)
    try {
      const res = await fetch(`/api/produtos/${productId}/componentes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: newCompId,
          variantId: newVariantId || null,
          quantityPerUnit: Number(newQty),
          notes: newNotes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Erro ao adicionar.')
        return
      }
      setNewCompId('')
      setNewQty('')
      setNewVariantId('')
      setNewNotes('')
      setFeedback('Componente vinculado.')
      load()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(bomId: string, fields: { quantityPerUnit?: number; notes?: string | null }) {
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/componentes/${bomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Erro.')
        return
      }
      load()
    } catch {
      setError('Erro de conexão.')
    }
  }

  async function handleRemove(bomId: string, componentName: string) {
    if (!window.confirm(`Remover "${componentName}" da BOM deste produto?`)) return
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/componentes/${bomId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Erro.')
        return
      }
      load()
    } catch {
      setError('Erro de conexão.')
    }
  }

  const grouped = useMemo(() => {
    const global = entries.filter(e => e.variantId === null)
    const byVariant = new Map<string, { name: string; entries: BomEntry[] }>()
    for (const entry of entries) {
      if (!entry.variantId) continue
      const cur = byVariant.get(entry.variantId)
      if (cur) cur.entries.push(entry)
      else byVariant.set(entry.variantId, { name: entry.variantName || entry.variantId, entries: [entry] })
    }
    return { global, byVariant: Array.from(byVariant.entries()).map(([id, val]) => ({ id, ...val })) }
  }, [entries])

  const availableComponents = components.filter(c => c.isActive)

  return (
    <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '17px', color: '#1D2235' }}>Componentes deste produto</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7494' }}>
            Declare o que cada unidade consome. A produção vai descontar automaticamente do estoque (Fase 3).
          </p>
        </div>
        {coverage && coverage.maxProducible !== null && (
          <CoverageBadge coverage={coverage} />
        )}
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
          {error}
        </div>
      )}
      {feedback && (
        <div style={{ background: '#DCFCE7', color: '#166534', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
          {feedback}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7494', fontSize: '13px' }}>Carregando...</p>
      ) : entries.length === 0 ? (
        <div style={{ background: '#FEF3C7', color: '#92400E', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ Este produto não tem componentes vinculados — a produção não vai debitar estoque.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '14px', marginBottom: '14px' }}>
          {grouped.global.length > 0 && (
            <BomTable
              title="Vínculos globais (todas as variações)"
              entries={grouped.global}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          )}
          {grouped.byVariant.map(group => (
            <BomTable
              key={group.id}
              title={`Vínculos da variação: ${group.name}`}
              entries={group.entries}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Não pode ser <form> aqui — este componente é embarcado dentro do
          form do editor de produto e HTML não permite forms aninhados. Usar
          div + button type="button" evita que clicar em "Adicionar componente"
          submeta o form externo (que salva o produto e redireciona). */}
      <div style={{ borderTop: '1px solid #E3E9F4', paddingTop: '14px', display: 'grid', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#1D2235' }}>+ Vincular novo componente</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <Field label="Componente">
            <select value={newCompId} onChange={e => setNewCompId(e.target.value)} style={input}>
              <option value="">Selecione...</option>
              {availableComponents.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.unit}) {c.sku ? `· ${c.sku}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantidade por unidade">
            <input
              type="number"
              min="0"
              step="any"
              value={newQty}
              onChange={e => setNewQty(e.target.value)}
              placeholder="Ex.: 1, 0.045"
              style={input}
            />
          </Field>
          {variants.length > 0 && (
            <Field label="Aplicar a">
              <select value={newVariantId} onChange={e => setNewVariantId(e.target.value)} style={input}>
                <option value="">Todas as variações (global)</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>Variação: {v.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Observação (opcional)">
            <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Ex.: usar só na cor preta" style={input} />
          </Field>
        </div>
        <div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newCompId || !newQty}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving || !newCompId || !newQty ? 'not-allowed' : 'pointer', fontSize: '13px' }}
          >
            {saving ? 'Salvando...' : '+ Adicionar componente'}
          </button>
        </div>
      </div>
    </section>
  )
}

function BomTable({
  title,
  entries,
  onUpdate,
  onRemove,
}: {
  title: string
  entries: BomEntry[]
  onUpdate: (bomId: string, fields: { quantityPerUnit?: number; notes?: string | null }) => void
  onRemove: (bomId: string, componentName: string) => void
}) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</p>
      <div style={{ border: '1px solid #E3E9F4', borderRadius: '10px', overflow: 'hidden' }}>
        {entries.map((entry, idx) => (
          <BomRow
            key={entry.id}
            entry={entry}
            isLast={idx === entries.length - 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}

function BomRow({
  entry,
  isLast,
  onUpdate,
  onRemove,
}: {
  entry: BomEntry
  isLast: boolean
  onUpdate: (bomId: string, fields: { quantityPerUnit?: number; notes?: string | null }) => void
  onRemove: (bomId: string, componentName: string) => void
}) {
  const [qty, setQty] = useState(String(entry.quantityPerUnit))
  const [notes, setNotes] = useState(entry.notes || '')
  const [editing, setEditing] = useState(false)
  const dirty = qty !== String(entry.quantityPerUnit) || notes !== (entry.notes || '')
  const stockAfter = entry.componentStock
  const isLow = entry.componentLowThreshold !== null && stockAfter <= entry.componentLowThreshold

  return (
    <div style={{ padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid #E3E9F4', display: 'grid', gap: '8px', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#1D2235' }}>
            {entry.componentName}
            {isLow && <span style={{ marginLeft: '8px', background: '#FEE2E2', color: '#B42318', fontSize: '11px', padding: '2px 8px', borderRadius: '999px' }}>em baixa</span>}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7494' }}>
            Estoque: {formatNumber(stockAfter, entry.componentUnit)} {entry.componentUnit} ·
            cobertura: {entry.coverageUnits} {entry.coverageUnits === 1 ? 'unidade' : 'unidades'} produtíveis
          </p>
        </div>
        {editing ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                onUpdate(entry.id, {
                  quantityPerUnit: Number(qty),
                  notes: notes.trim() || null,
                })
                setEditing(false)
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed', opacity: dirty ? 1 : 0.5, fontSize: '12px' }}
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setQty(String(entry.quantityPerUnit))
                setNotes(entry.notes || '')
                setEditing(false)
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry.id, entry.componentName)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', cursor: 'pointer', fontSize: '12px' }}
            >
              Remover
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: '#1D2235', fontWeight: 600, display: 'grid', gap: '4px' }}>
            Quantidade por unidade ({entry.componentUnit})
            <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} style={input} />
          </label>
          <label style={{ fontSize: '12px', color: '#1D2235', fontWeight: 600, display: 'grid', gap: '4px' }}>
            Observação
            <input value={notes} onChange={e => setNotes(e.target.value)} style={input} />
          </label>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '13px', color: '#1D2235' }}>
          <strong>{formatNumber(entry.quantityPerUnit, entry.componentUnit)} {entry.componentUnit}</strong> por unidade
          {entry.notes && <span style={{ color: '#6B7494' }}> · {entry.notes}</span>}
        </p>
      )}
    </div>
  )
}

function CoverageBadge({ coverage }: { coverage: Coverage }) {
  const value = coverage.maxProducible
  if (value === null) return null
  const isLow = value === 0
  return (
    <div style={{ background: isLow ? '#FEE2E2' : '#DCFCE7', color: isLow ? '#B42318' : '#166534', padding: '8px 14px', borderRadius: '10px', textAlign: 'right' }}>
      <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dá pra produzir</p>
      <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
        {value} {value === 1 ? 'unidade' : 'unidades'}
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#1D2235', fontWeight: 600 }}>
      {label}
      {children}
    </label>
  )
}

const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #D8DCE8',
  fontSize: '13px',
  fontFamily: 'inherit',
  width: '100%',
}
