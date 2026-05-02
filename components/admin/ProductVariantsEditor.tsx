'use client'

import { useEffect, useState } from 'react'

type Variant = {
  id: string
  productId: string
  name: string
  sku: string | null
  color: string | null
  size: string | null
  material: string | null
  finish: string | null
  priceDelta: number | null
  priceOverride: number | null
  stockQuantity: number
  isAvailable: boolean
  productionMinutesPerUnit: number | null
}

type PriceMode = 'delta' | 'override'

type FormState = {
  name: string
  sku: string
  color: string
  size: string
  material: string
  finish: string
  priceMode: PriceMode
  priceDelta: string
  priceOverride: string
  stockQuantity: string
  isAvailable: boolean
}

const emptyForm: FormState = {
  name: '',
  sku: '',
  color: '',
  size: '',
  material: '',
  finish: '',
  priceMode: 'delta',
  priceDelta: '',
  priceOverride: '',
  stockQuantity: '0',
  isAvailable: true,
}

function variantToForm(v: Variant): FormState {
  const hasOverride = v.priceOverride !== null && v.priceOverride !== undefined
  return {
    name: v.name || '',
    sku: v.sku || '',
    color: v.color || '',
    size: v.size || '',
    material: v.material || '',
    finish: v.finish || '',
    priceMode: hasOverride ? 'override' : 'delta',
    priceDelta: v.priceDelta !== null && v.priceDelta !== undefined ? String(v.priceDelta) : '',
    priceOverride: hasOverride ? String(v.priceOverride) : '',
    stockQuantity: String(v.stockQuantity ?? 0),
    isAvailable: v.isAvailable !== false,
  }
}

function formatAttributes(v: Variant) {
  const parts: string[] = []
  if (v.color) parts.push(v.color)
  if (v.size) parts.push(v.size)
  if (v.material) parts.push(v.material)
  if (v.finish) parts.push(v.finish)
  return parts.length ? parts.join(' / ') : '—'
}

function formatPrice(v: Variant) {
  if (v.priceOverride !== null && v.priceOverride !== undefined) {
    return `R$ ${Number(v.priceOverride).toFixed(2).replace('.', ',')} (fixo)`
  }
  if (v.priceDelta !== null && v.priceDelta !== undefined && Number(v.priceDelta) !== 0) {
    const delta = Number(v.priceDelta)
    const sign = delta > 0 ? '+' : '−'
    return `Base ${sign} R$ ${Math.abs(delta).toFixed(2).replace('.', ',')}`
  }
  return 'Mesmo preço base'
}

export default function ProductVariantsEditor({ productId }: { productId: string }) {
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/variacoes`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setVariants(Array.isArray(data) ? data : [])
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erro ao carregar variações.')
      }
    } catch {
      setError('Erro ao carregar variações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  function startCreate() {
    setForm(emptyForm)
    setEditingVariantId(null)
    setCreating(true)
    setError('')
  }

  function startEdit(v: Variant) {
    setForm(variantToForm(v))
    setEditingVariantId(v.id)
    setCreating(false)
    setError('')
  }

  function cancelForm() {
    setEditingVariantId(null)
    setCreating(false)
    setForm(emptyForm)
    setError('')
  }

  function buildPayload(): Record<string, unknown> | string {
    if (!form.name.trim()) return 'Informe um nome para a variação.'

    const stockNum = parseInt(form.stockQuantity, 10)
    if (Number.isNaN(stockNum) || stockNum < 0) return 'Estoque deve ser um número >= 0.'

    let priceDelta: number | null = null
    let priceOverride: number | null = null

    if (form.priceMode === 'override') {
      if (form.priceOverride.trim() !== '') {
        const n = parseFloat(form.priceOverride)
        if (Number.isNaN(n) || n < 0) return 'Preço fixo deve ser um número >= 0.'
        priceOverride = n
      }
    } else {
      if (form.priceDelta.trim() !== '') {
        const n = parseFloat(form.priceDelta)
        if (Number.isNaN(n)) return 'Variação de preço deve ser um número.'
        priceDelta = n
      }
    }

    return {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      color: form.color.trim() || null,
      size: form.size.trim() || null,
      material: form.material.trim() || null,
      finish: form.finish.trim() || null,
      priceDelta,
      priceOverride,
      stockQuantity: stockNum,
      isAvailable: form.isAvailable,
    }
  }

  async function handleSave() {
    const payload = buildPayload()
    if (typeof payload === 'string') {
      setError(payload)
      return
    }
    setBusy(true)
    setError('')
    try {
      const url = editingVariantId
        ? `/api/produtos/${productId}/variacoes/${editingVariantId}`
        : `/api/produtos/${productId}/variacoes`
      const res = await fetch(url, {
        method: editingVariantId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erro ao salvar variação.')
        return
      }
      cancelForm()
      await load()
    } catch {
      setError('Erro ao salvar variação. Verifique sua conexão.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(variantId: string) {
    if (!confirm('Excluir esta variação? Esta ação não pode ser desfeita.')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/variacoes/${variantId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erro ao excluir variação.')
        return
      }
      if (editingVariantId === variantId) cancelForm()
      await load()
    } catch {
      setError('Erro ao excluir variação.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleAvailable(v: Variant) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/variacoes/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !v.isAvailable }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Erro ao atualizar disponibilidade.')
        return
      }
      await load()
    } catch {
      setError('Erro ao atualizar disponibilidade.')
    } finally {
      setBusy(false)
    }
  }

  const showForm = creating || editingVariantId !== null

  if (loading) {
    return <p style={{ color: '#6B7494', fontSize: '13px' }}>Carregando variações...</p>
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1D2235', margin: 0 }}>
          Variações do produto ({variants.length})
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={startCreate}
            disabled={busy}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #D8DCE8',
              background: '#F0F5FB',
              color: '#1D2235',
              fontSize: '13px',
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            + Nova variação
          </button>
        )}
      </div>

      <p style={{ marginTop: 0, marginBottom: '12px', fontSize: '12px', color: '#6B7494' }}>
        Use variações para gerenciar estoque por opção (ex: tamanhos, cores, materiais). Ao cadastrar variações, o
        estoque global do produto é ignorado.
      </p>

      {error && (
        <p
          role="alert"
          style={{
            marginBottom: '12px',
            padding: '10px 12px',
            background: '#F1E5E9',
            color: '#A3526A',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {error}
        </p>
      )}

      {variants.length === 0 && !showForm ? (
        <p
          style={{
            color: '#6B7494',
            fontSize: '13px',
            padding: '24px',
            background: '#F0F5FB',
            borderRadius: '10px',
            textAlign: 'center',
          }}
        >
          Este produto ainda não tem variações. Crie variações para gerenciar estoque por opção (ex: tamanhos, cores).
        </p>
      ) : (
        variants.length > 0 && (
          <div
            style={{
              border: '1px solid #D8DCE8',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: showForm ? '16px' : 0,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
                  <th style={th}>Nome</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Atributos</th>
                  <th style={th}>Preço</th>
                  <th style={th}>Estoque</th>
                  <th style={th}>Ativo</th>
                  <th style={{ ...th, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => {
                  const isEditing = editingVariantId === v.id
                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: '1px solid #EEF1F8',
                        background: isEditing ? '#FAFCFE' : 'white',
                      }}
                    >
                      <td style={td}>
                        <span style={{ fontWeight: 600, color: '#1D2235' }}>{v.name}</span>
                      </td>
                      <td style={{ ...td, color: '#6B7494', fontFamily: 'var(--font-mono)' }}>{v.sku || '—'}</td>
                      <td style={{ ...td, color: '#6B7494' }}>{formatAttributes(v)}</td>
                      <td style={{ ...td, color: '#1D2235' }}>{formatPrice(v)}</td>
                      <td style={td}>
                        <span style={{ color: v.stockQuantity > 0 ? '#1D7A72' : '#A3526A', fontWeight: 600 }}>
                          {v.stockQuantity} un
                        </span>
                      </td>
                      <td style={td}>
                        <button
                          type="button"
                          onClick={() => handleToggleAvailable(v)}
                          disabled={busy}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: 'none',
                            cursor: busy ? 'not-allowed' : 'pointer',
                            backgroundColor: v.isAvailable ? '#DFF4EC' : '#FDE8E8',
                            color: v.isAvailable ? '#1D7A72' : '#B42318',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {v.isAvailable ? 'SIM' : 'NÃO'}
                        </button>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => startEdit(v)}
                            disabled={busy}
                            style={rowBtn}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v.id)}
                            disabled={busy}
                            style={{ ...rowBtn, borderColor: '#D4849A', color: '#A3526A' }}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {showForm && (
        <div
          style={{
            border: '1px solid #D8DCE8',
            borderRadius: '12px',
            padding: '16px',
            background: 'white',
            marginTop: variants.length > 0 ? 0 : '0',
          }}
        >
          <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 700, color: '#1D2235' }}>
            {editingVariantId ? 'Editar variação' : 'Nova variação'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={lbl}>Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Madeira clara - P"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                placeholder="Opcional"
                style={inp}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <div>
              <label style={lbl}>Cor</label>
              <input
                type="text"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                placeholder="Ex: Branco"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Tamanho</label>
              <input
                type="text"
                value={form.size}
                onChange={e => setForm({ ...form, size: e.target.value })}
                placeholder="Ex: P / 10cm"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Material</label>
              <input
                type="text"
                value={form.material}
                onChange={e => setForm({ ...form, material: e.target.value })}
                placeholder="Ex: PLA"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Acabamento</label>
              <input
                type="text"
                value={form.finish}
                onChange={e => setForm({ ...form, finish: e.target.value })}
                placeholder="Ex: Fosco"
                style={inp}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ ...lbl, marginBottom: '8px' }}>Preço (escolha um)</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1D2235', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="priceMode"
                  checked={form.priceMode === 'delta'}
                  onChange={() => setForm({ ...form, priceMode: 'delta' })}
                />
                <span>Variação do preço base (R$ +/−)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1D2235', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="priceMode"
                  checked={form.priceMode === 'override'}
                  onChange={() => setForm({ ...form, priceMode: 'override' })}
                />
                <span>Preço fixo absoluto (R$)</span>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {form.priceMode === 'delta' ? (
                <div>
                  <label style={lbl}>Variação (pode ser negativa)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.priceDelta}
                    onChange={e => setForm({ ...form, priceDelta: e.target.value })}
                    placeholder="Ex: 10.00 ou -5.00"
                    style={inp}
                  />
                </div>
              ) : (
                <div>
                  <label style={lbl}>Preço fixo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.priceOverride}
                    onChange={e => setForm({ ...form, priceOverride: e.target.value })}
                    placeholder="Ex: 99.90"
                    style={inp}
                  />
                </div>
              )}
              <div>
                <label style={lbl}>Estoque</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockQuantity}
                  onChange={e => setForm({ ...form, stockQuantity: e.target.value })}
                  style={inp}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={e => setForm({ ...form, isAvailable: e.target.checked })}
              />
              <span>Disponível para venda</span>
            </label>
          </div>

          <div style={{ marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#1D2235',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={busy}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #D8DCE8',
                background: 'white',
                color: '#1D2235',
                fontSize: '13px',
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 700,
  color: '#1D2235',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const td: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
}

const rowBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  background: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  color: '#1D2235',
  fontWeight: 600,
}

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '4px',
  color: '#1D2235',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '13px',
  color: '#1D2235',
  background: 'white',
  boxSizing: 'border-box',
}
