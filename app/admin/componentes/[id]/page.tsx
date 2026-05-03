'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { COMPONENT_UNITS, unitLabel } from '@/lib/units'

type Component = {
  id: string
  sku: string | null
  name: string
  description: string | null
  unit: string
  stock: number
  lowStockThreshold: number | null
  supplier: string | null
  supplierUrl: string | null
  costPerUnit: number | null
  notes: string | null
  isActive: boolean
  isLow: boolean
  updatedAt: string
}

type Movement = {
  id: string
  type: 'in' | 'out' | 'adjust' | 'reverse'
  quantity: number
  balanceAfter: number
  reason: string | null
  relatedOrderNumber: string | null
  createdByEmail: string | null
  createdAt: string
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  in: { label: 'Entrada', color: '#166534', bg: '#DCFCE7' },
  out: { label: 'Saída', color: '#B42318', bg: '#FEE2E2' },
  adjust: { label: 'Ajuste', color: '#92400E', bg: '#FEF3C7' },
  reverse: { label: 'Reversão', color: '#4A7AB5', bg: '#E4EDF8' },
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function formatNumber(n: number, unit: string): string {
  const decimals = ['kg', 'g', 'L', 'ml', 'm'].includes(unit) ? 3 : 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

export default function ComponentDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [component, setComponent] = useState<Component | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Edit form
  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    unit: 'un',
    lowStockThreshold: '',
    supplier: '',
    supplierUrl: '',
    costPerUnit: '',
    notes: '',
    isActive: true,
  })

  // Movement modal
  const [showMov, setShowMov] = useState(false)
  const [mov, setMov] = useState({ type: 'in' as 'in' | 'out' | 'adjust', quantity: '', reason: '' })
  const [movSaving, setMovSaving] = useState(false)
  const [movError, setMovError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/componentes/${id}`, { cache: 'no-store' })
      if (!res.ok) {
        setFeedback({ kind: 'err', text: 'Componente não encontrado.' })
        return
      }
      const data = await res.json()
      setComponent(data.component)
      setMovements(data.movements || [])
      setForm({
        sku: data.component.sku || '',
        name: data.component.name,
        description: data.component.description || '',
        unit: data.component.unit,
        lowStockThreshold: data.component.lowStockThreshold !== null ? String(data.component.lowStockThreshold) : '',
        supplier: data.component.supplier || '',
        supplierUrl: data.component.supplierUrl || '',
        costPerUnit: data.component.costPerUnit !== null ? String(data.component.costPerUnit) : '',
        notes: data.component.notes || '',
        isActive: data.component.isActive,
      })
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) load()
  }, [id, load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/componentes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku.trim() || null,
          name: form.name.trim(),
          description: form.description.trim() || null,
          unit: form.unit,
          lowStockThreshold: form.lowStockThreshold === '' ? null : Number(form.lowStockThreshold),
          supplier: form.supplier.trim() || null,
          supplierUrl: form.supplierUrl.trim() || null,
          costPerUnit: form.costPerUnit === '' ? null : Number(form.costPerUnit),
          notes: form.notes.trim() || null,
          isActive: form.isActive,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFeedback({ kind: 'err', text: data?.error || 'Erro ao salvar.' })
        return
      }
      setFeedback({ kind: 'ok', text: 'Componente atualizado.' })
      load()
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault()
    setMovSaving(true)
    setMovError('')
    try {
      const res = await fetch(`/api/componentes/${id}/movimento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mov.type,
          quantity: Number(mov.quantity),
          reason: mov.reason.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMovError(data?.error || 'Erro ao lançar movimento.')
        return
      }
      setShowMov(false)
      setMov({ type: 'in', quantity: '', reason: '' })
      load()
    } catch {
      setMovError('Erro de conexão.')
    } finally {
      setMovSaving(false)
    }
  }

  async function handleDelete() {
    if (!component) return
    if (!window.confirm(`Excluir o componente "${component.name}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/componentes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      alert(data?.error || 'Erro ao excluir.')
      return
    }
    router.push('/admin/componentes')
  }

  if (loading) {
    return (
      <div>
        <Link href="/admin/componentes" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar</Link>
        <p style={{ marginTop: '24px', color: '#6B7494' }}>Carregando...</p>
      </div>
    )
  }

  if (!component) {
    return (
      <div>
        <Link href="/admin/componentes" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar</Link>
        <p style={{ marginTop: '24px', color: '#B42318' }}>Componente não encontrado.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link href="/admin/componentes" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar para componentes</Link>
      </div>

      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Estoque</p>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#1D2235', margin: '6px 0 4px' }}>{component.name}</h1>
        {component.sku && <p style={{ color: '#6B7494', margin: 0, fontFamily: 'var(--font-mono)', fontSize: '13px' }}>SKU: {component.sku}</p>}
      </header>

      {feedback && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: feedback.kind === 'ok' ? '#166534' : '#B42318' }}>
          {feedback.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: '20px', alignItems: 'start' }}>
        <form onSubmit={handleSave} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>Dados do componente</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <Field label="Nome *">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
            </Field>
            <Field label="SKU">
              <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={input} />
            </Field>
            <Field label="Unidade *">
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={input}>
                {COMPONENT_UNITS.map(u => (
                  <option key={u} value={u}>{u} ({unitLabel(u)})</option>
                ))}
              </select>
            </Field>
            <Field label="Limite mínimo">
              <input type="number" min="0" step="any" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} placeholder="vazio = sem alerta" style={input} />
            </Field>
            <Field label="Custo unitário (R$)">
              <input type="number" min="0" step="0.01" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} style={input} />
            </Field>
            <Field label="Fornecedor">
              <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={input} />
            </Field>
            <Field label="Link de recompra">
              <input type="url" value={form.supplierUrl} onChange={e => setForm({ ...form, supplierUrl: e.target.value })} style={input} />
            </Field>
          </div>
          <Field label="Descrição">
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={input} />
          </Field>
          <Field label="Observações internas">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={input} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Componente ativo
          </label>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button type="button" onClick={handleDelete} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', fontWeight: 600, cursor: 'pointer' }}>
              Excluir componente
            </button>
          </div>
        </form>

        <aside style={{ display: 'grid', gap: '16px', position: 'sticky', top: '32px' }}>
          <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Estoque atual</p>
            <p style={{ margin: '8px 0 4px', fontSize: '34px', fontWeight: 700, color: '#1D2235', fontFamily: 'var(--font-mono)' }}>
              {formatNumber(component.stock, component.unit)} <span style={{ fontSize: '18px', color: '#6B7494', fontWeight: 600 }}>{component.unit}</span>
            </p>
            {component.lowStockThreshold !== null && (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: component.isLow ? '#B42318' : '#6B7494' }}>
                {component.isLow ? '⚠️ Abaixo do limite' : '✓ Acima do limite'} de {formatNumber(component.lowStockThreshold, component.unit)} {component.unit}
              </p>
            )}
            <button
              onClick={() => { setMovError(''); setShowMov(true) }}
              style={{ width: '100%', padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D7A72', color: 'white', fontWeight: 600, cursor: 'pointer' }}
            >
              + Lançar movimento
            </button>
            {component.supplierUrl && (
              <a
                href={component.supplierUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: '8px', padding: '8px', textAlign: 'center', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#4A7AB5', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}
              >
                🛒 Comprar com fornecedor
              </a>
            )}
          </section>

          <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '15px' }}>Histórico</h2>
              {movements.length > 0 && (
                <a
                  href={`/api/componentes/${id}/historico`}
                  download
                  style={{ fontSize: '12px', color: '#4A7AB5', textDecoration: 'none', fontWeight: 600 }}
                >
                  ⬇ Exportar CSV
                </a>
              )}
            </div>
            {movements.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: '#6B7494' }}>Nenhuma movimentação registrada.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                {movements.map(m => {
                  const meta = TYPE_LABELS[m.type] || TYPE_LABELS.adjust
                  const sign = m.type === 'in' || m.type === 'reverse' ? '+' : '-'
                  return (
                    <li key={m.id} style={{ borderLeft: `3px solid ${meta.color}`, paddingLeft: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: meta.bg, color: meta.color, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                          {meta.label}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: meta.color }}>
                          {sign}{formatNumber(m.quantity, component.unit)} {component.unit}
                        </span>
                      </div>
                      {m.reason && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#1D2235' }}>{m.reason}</p>}
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7494' }}>
                        Saldo após: {formatNumber(m.balanceAfter, component.unit)} {component.unit}
                        {m.relatedOrderNumber && ` · pedido ${m.relatedOrderNumber}`}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#A8AFCA' }}>
                        {formatDate(m.createdAt)}
                        {m.createdByEmail && ` · ${m.createdByEmail}`}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {showMov && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleMovement} style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '420px', width: '90%', display: 'grid', gap: '12px' }}>
            <h2 style={{ margin: 0 }}>Lançar movimento</h2>
            <Field label="Tipo">
              <select value={mov.type} onChange={e => setMov({ ...mov, type: e.target.value as 'in' | 'out' | 'adjust' })} style={input}>
                <option value="in">Entrada (compra, recebimento)</option>
                <option value="out">Saída (perda, descarte)</option>
                <option value="adjust">Ajuste (correção de inventário, sai do estoque)</option>
              </select>
            </Field>
            <Field label={`Quantidade (em ${component.unit})`}>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={mov.quantity}
                onChange={e => setMov({ ...mov, quantity: e.target.value })}
                style={input}
              />
            </Field>
            <Field label="Motivo (opcional)">
              <input value={mov.reason} onChange={e => setMov({ ...mov, reason: e.target.value })} placeholder="Ex.: Compra fornecedor X" style={input} />
            </Field>
            {movError && <p role="alert" style={{ margin: 0, color: '#B42318', fontSize: '13px' }}>{movError}</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowMov(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={movSaving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: movSaving ? 'not-allowed' : 'pointer' }}>
                {movSaving ? 'Lançando...' : 'Lançar'}
              </button>
            </div>
          </form>
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
