'use client'

import { useEffect, useMemo, useState } from 'react'

const TYPE_OPTIONS = [
  { value: 'PLA', label: 'PLA' },
  { value: 'PETG', label: 'PETG' },
  { value: 'TPU', label: 'TPU' },
  { value: 'ABS', label: 'ABS' },
  { value: 'PETG-HF', label: 'PETG HF' },
  { value: 'PLA-Speed+', label: 'PLA Speed+' },
  { value: 'OTHER', label: 'Outro' },
] as const

type Filament = {
  id: string
  name: string
  brand: string | null
  type: string
  pricePerKg: number
  pricePerGram: number
  colorHex: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type FormState = {
  id: string | null
  name: string
  brand: string
  type: string
  pricePerKg: string
  colorHex: string
  notes: string
  isActive: boolean
}

const EMPTY: FormState = {
  id: null,
  name: '',
  brand: '',
  type: 'PLA',
  pricePerKg: '',
  colorHex: '',
  notes: '',
  isActive: true,
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function typeLabel(type: string): string {
  return TYPE_OPTIONS.find(o => o.value === type)?.label || type
}

export default function FilamentosPage() {
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/filamentos', { cache: 'no-store' })
      if (!res.ok) {
        setError('Erro ao carregar.')
        return
      }
      const data = await res.json()
      setFilaments(Array.isArray(data.filaments) ? data.filaments : [])
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return filaments
    const q = search.toLowerCase()
    return filaments.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.brand || '').toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q),
    )
  }, [filaments, search])

  function startEdit(f: Filament) {
    setForm({
      id: f.id,
      name: f.name,
      brand: f.brand || '',
      type: f.type,
      pricePerKg: String(f.pricePerKg),
      colorHex: f.colorHex || '',
      notes: f.notes || '',
      isActive: f.isActive,
    })
    setShowForm(true)
    setFeedback(null)
  }

  function cancelForm() {
    setForm(EMPTY)
    setShowForm(false)
    setFeedback(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        type: form.type,
        pricePerKg: form.pricePerKg === '' ? 0 : Number(form.pricePerKg),
        colorHex: form.colorHex || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      }
      const url = form.id ? `/api/filamentos/${form.id}` : '/api/filamentos'
      const method = form.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFeedback({ kind: 'err', text: data?.error || 'Erro ao salvar.' })
        return
      }
      setFeedback({ kind: 'ok', text: form.id ? 'Filamento atualizado.' : 'Filamento criado.' })
      setForm(EMPTY)
      setShowForm(false)
      load()
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(f: Filament) {
    if (!window.confirm(`Excluir "${f.name}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/filamentos/${f.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      alert(data?.error || 'Erro ao excluir.')
      return
    }
    load()
  }

  return (
    <div>
      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Insumos de produção</p>
          <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: '#1D2235', margin: '6px 0 4px' }}>Filamentos</h1>
          <p style={{ color: '#6B7494', margin: 0 }}>
            Catálogo de filamentos com custo por kilo. Usado pra calcular custo de produção dos produtos.
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setShowForm(s => !s); setFeedback(null) }}
          style={{ padding: '10px 18px', borderRadius: '10px', background: '#1D2235', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          {showForm ? 'Fechar formulário' : '+ Novo filamento'}
        </button>
      </header>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>{error}</div>
      )}
      {feedback && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: feedback.kind === 'ok' ? '#166534' : '#B42318' }}>
          {feedback.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px', display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '17px' }}>{form.id ? 'Editar filamento' : 'Novo filamento'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <Field label="Nome *">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} placeholder="Ex.: PLA Branco Premium" />
            </Field>
            <Field label="Marca">
              <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} style={input} placeholder="Ex.: 3D Fila" />
            </Field>
            <Field label="Tipo *">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={input} required>
                {TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Custo por kilo (R$) *">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.pricePerKg}
                onChange={e => setForm({ ...form, pricePerKg: e.target.value })}
                style={input}
                placeholder="Ex.: 95.00"
              />
            </Field>
            <Field label="Cor">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={form.colorHex || '#FFFFFF'}
                  onChange={e => setForm({ ...form, colorHex: e.target.value.toUpperCase() })}
                  style={{
                    width: '44px',
                    height: '38px',
                    padding: '2px',
                    border: '1px solid #D8DCE8',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'white',
                    flexShrink: 0,
                  }}
                  aria-label="Selecionar cor do filamento"
                />
                <input
                  value={form.colorHex}
                  onChange={e => setForm({ ...form, colorHex: e.target.value.toUpperCase() })}
                  style={{ ...input, flex: 1, fontFamily: 'var(--font-mono)' }}
                  placeholder="#RRGGBB"
                  maxLength={7}
                />
                {form.colorHex && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, colorHex: '' })}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px' }}
                    title="Limpar cor"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </Field>
          </div>
          <Field label="Observações internas">
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              style={input}
              placeholder="Cor, fornecedor, observações..."
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1D2235' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
            />
            Filamento ativo (produtos só conseguem usar filamentos ativos)
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar filamento'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input
          placeholder="Buscar por nome, marca ou tipo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...input, maxWidth: '320px' }}
        />
      </div>

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#6B7494', margin: 0 }}>Nenhum filamento cadastrado.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FBFD' }}>
                <th style={th}>Nome</th>
                <th style={th}>Marca</th>
                <th style={th}>Tipo</th>
                <th style={{ ...th, textAlign: 'right' }}>R$/kg</th>
                <th style={{ ...th, textAlign: 'right' }}>R$/g</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} style={{ borderTop: '1px solid #E3E9F4' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {f.colorHex ? (
                        <span
                          aria-label={`Cor ${f.colorHex}`}
                          title={f.colorHex}
                          style={{
                            display: 'inline-block',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: f.colorHex,
                            border: '1px solid #D8DCE8',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span style={{ display: 'inline-block', width: '18px', height: '18px', flexShrink: 0 }} aria-hidden />
                      )}
                      <strong style={{ color: '#1D2235' }}>{f.name}</strong>
                    </div>
                    {f.notes && <p style={{ margin: '4px 0 0 26px', fontSize: '12px', color: '#6B7494' }}>{f.notes}</p>}
                  </td>
                  <td style={{ ...td, color: '#6B7494' }}>{f.brand || '—'}</td>
                  <td style={td}>
                    <span style={{ background: '#E4EDF8', color: '#4A7AB5', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>
                      {typeLabel(f.type)}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {formatBRL(f.pricePerKg)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#6B7494', fontSize: '13px' }}>
                    {formatBRL(f.pricePerGram)}
                  </td>
                  <td style={td}>
                    {f.isActive ? (
                      <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>Ativo</span>
                    ) : (
                      <span style={{ background: '#F3F4F6', color: '#6B7494', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>Inativo</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginRight: '6px' }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#1D2235', fontWeight: 600 }}>
      {label}
      {children}
    </label>
  )
}

const input: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  fontFamily: 'inherit',
  width: '100%',
}

const th: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6B7494',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const td: React.CSSProperties = { padding: '12px 16px', fontSize: '14px', color: '#1D2235' }
