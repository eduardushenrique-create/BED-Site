'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { COMPONENT_UNITS, unitLabel } from '@/lib/units'

type Component = {
  id: string
  sku: string | null
  name: string
  unit: string
  stock: number
  lowStockThreshold: number | null
  supplier: string | null
  isActive: boolean
  isLow: boolean
  costPerUnit: number | null
  createdAt: string
  updatedAt: string
}

type FormState = {
  sku: string
  name: string
  description: string
  unit: string
  stock: string
  lowStockThreshold: string
  supplier: string
  supplierUrl: string
  costPerUnit: string
  notes: string
}

const EMPTY: FormState = {
  sku: '',
  name: '',
  description: '',
  unit: 'un',
  stock: '0',
  lowStockThreshold: '',
  supplier: '',
  supplierUrl: '',
  costPerUnit: '',
  notes: '',
}

function formatNumber(n: number, unit: string): string {
  const decimals = ['kg', 'g', 'L', 'ml', 'm'].includes(unit) ? 3 : 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

export default function ComponentesPage() {
  const [components, setComponents] = useState<Component[]>([])
  const [kpis, setKpis] = useState<{ total: number; inLow: number; zeroed: number; estimatedValue: number | null; componentsWithCost: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'inactive'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [listRes, kpisRes] = await Promise.all([
        fetch('/api/componentes', { cache: 'no-store' }),
        fetch('/api/componentes/kpis', { cache: 'no-store' }),
      ])
      if (!listRes.ok) {
        setError('Erro ao carregar.')
        return
      }
      const data = await listRes.json()
      setComponents(Array.isArray(data.components) ? data.components : [])
      if (kpisRes.ok) {
        setKpis(await kpisRes.json())
      }
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
    return components.filter(c => {
      if (filter === 'low' && !c.isLow) return false
      if (filter === 'inactive' && c.isActive) return false
      if (filter === 'all' && !c.isActive) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) && !(c.sku || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [components, filter, search])

  const lowCount = components.filter(c => c.isLow && c.isActive).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/componentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku.trim() || null,
          name: form.name.trim(),
          description: form.description.trim() || null,
          unit: form.unit,
          stock: form.stock === '' ? 0 : Number(form.stock),
          lowStockThreshold: form.lowStockThreshold === '' ? null : Number(form.lowStockThreshold),
          supplier: form.supplier.trim() || null,
          supplierUrl: form.supplierUrl.trim() || null,
          costPerUnit: form.costPerUnit === '' ? null : Number(form.costPerUnit),
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Erro ao criar.')
        return
      }
      setForm(EMPTY)
      setShowForm(false)
      load()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Estoque</p>
          <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: '#1D2235', margin: '6px 0 4px' }}>
            Componentes
            {lowCount > 0 && (
              <span style={{ marginLeft: '12px', background: '#FEE2E2', color: '#B42318', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', verticalAlign: 'middle' }}>
                {lowCount} em baixa
              </span>
            )}
          </h1>
          <p style={{ color: '#6B7494', margin: 0 }}>
            Matérias-primas e insumos usados na produção (filamento, TAGs NFC, fitas LED, etc.).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            href="/admin/configuracoes/alertas"
            style={{ padding: '10px 18px', borderRadius: '10px', background: 'white', color: '#1D2235', textDecoration: 'none', fontWeight: 600, border: '1px solid #D8DCE8' }}
          >
            ⚙️ Alertas
          </Link>
          <button
            onClick={() => setShowForm(s => !s)}
            style={{ padding: '10px 18px', borderRadius: '10px', background: '#1D2235', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            {showForm ? 'Cancelar' : '+ Novo componente'}
          </button>
        </div>
      </header>

      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <KpiCard label="Componentes ativos" value={String(kpis.total)} />
          <KpiCard label="Em baixa" value={String(kpis.inLow)} tone={kpis.inLow > 0 ? 'warn' : 'neutral'} />
          <KpiCard label="Zerados" value={String(kpis.zeroed)} tone={kpis.zeroed > 0 ? 'danger' : 'neutral'} />
          {kpis.estimatedValue !== null ? (
            <KpiCard
              label="Valor estimado em estoque"
              value={`R$ ${kpis.estimatedValue.toFixed(2).replace('.', ',')}`}
              hint={`baseado em ${kpis.componentsWithCost} ${kpis.componentsWithCost === 1 ? 'componente' : 'componentes'} com custo cadastrado`}
            />
          ) : (
            <KpiCard label="Valor em estoque" value="—" hint="cadastre 'custo unitário' nos componentes pra ver" />
          )}
        </div>
      )}

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px', display: 'grid', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '17px' }}>Novo componente</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <Field label="Nome *">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
            </Field>
            <Field label="SKU (opcional)">
              <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={input} />
            </Field>
            <Field label="Unidade *">
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={input} required>
                {COMPONENT_UNITS.map(u => (
                  <option key={u} value={u}>{u} ({unitLabel(u)})</option>
                ))}
              </select>
            </Field>
            <Field label="Estoque inicial">
              <input type="number" min="0" step="any" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={input} />
            </Field>
            <Field label="Limite mínimo (alerta)">
              <input type="number" min="0" step="any" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} placeholder="vazio = sem alerta" style={input} />
            </Field>
            <Field label="Custo por unidade (R$)">
              <input type="number" min="0" step="0.01" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} style={input} />
            </Field>
            <Field label="Fornecedor">
              <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={input} />
            </Field>
            <Field label="Link de recompra">
              <input type="url" value={form.supplierUrl} onChange={e => setForm({ ...form, supplierUrl: e.target.value })} style={input} placeholder="https://..." />
            </Field>
          </div>
          <Field label="Descrição">
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={input} />
          </Field>
          <Field label="Observações internas">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={input} />
          </Field>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={saving} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Salvando...' : 'Criar componente'}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por nome ou SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...input, maxWidth: '320px' }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {([
            { value: 'all', label: 'Ativos' },
            { value: 'low', label: 'Em baixa' },
            { value: 'inactive', label: 'Inativos' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #D8DCE8',
                background: filter === opt.value ? '#1D2235' : 'white',
                color: filter === opt.value ? 'white' : '#1D2235',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#6B7494', margin: 0 }}>Nenhum componente encontrado.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FBFD' }}>
                <th style={th}>Componente</th>
                <th style={th}>SKU</th>
                <th style={{ ...th, textAlign: 'right' }}>Estoque</th>
                <th style={{ ...th, textAlign: 'right' }}>Mínimo</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #E3E9F4' }}>
                  <td style={td}>
                    <Link href={`/admin/componentes/${c.id}`} style={{ color: '#1D2235', textDecoration: 'none', fontWeight: 600 }}>
                      {c.name}
                    </Link>
                    {c.supplier && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7494' }}>{c.supplier}</p>}
                  </td>
                  <td style={{ ...td, color: '#6B7494', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{c.sku || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {formatNumber(c.stock, c.unit)} <span style={{ color: '#6B7494', fontSize: '12px' }}>{c.unit}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#6B7494' }}>
                    {c.lowStockThreshold !== null ? `${formatNumber(c.lowStockThreshold, c.unit)} ${c.unit}` : '—'}
                  </td>
                  <td style={td}>
                    <StatusBadge component={c} />
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

function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'warn' | 'danger'
}) {
  const accent = tone === 'danger' ? '#B42318' : tone === 'warn' ? '#92400E' : '#1D2235'
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: 0, fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, color: accent }}>{value}</p>
      {hint && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6B7494' }}>{hint}</p>}
    </div>
  )
}

function StatusBadge({ component }: { component: Component }) {
  if (!component.isActive) {
    return <span style={{ background: '#F3F4F6', color: '#6B7494', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>Inativo</span>
  }
  if (component.stock === 0) {
    return <span style={{ background: '#FEE2E2', color: '#B42318', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>❌ Zerado</span>
  }
  if (component.isLow) {
    return <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>⚠️ Em baixa</span>
  }
  return <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>OK</span>
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
