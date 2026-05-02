'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Printer = {
  id: string
  name: string
  model: string | null
  buildVolume: string | null
  materials: string | null
  dailyCapacityMinutes: number
  status: 'active' | 'maintenance' | 'offline'
  color: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativa', color: '#10B981' },
  maintenance: { label: 'Em manutenção', color: '#F59E0B' },
  offline: { label: 'Desligada', color: '#6B7494' },
}

const emptyForm = {
  name: '',
  model: '',
  buildVolume: '',
  materials: '',
  dailyCapacityMinutes: 480,
  status: 'active' as Printer['status'],
  color: '',
  notes: '',
}

export default function ImpressorasPage() {
  const [items, setItems] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/impressoras', { cache: 'no-store' })
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function openEdit(p: Printer) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      model: p.model || '',
      buildVolume: p.buildVolume || '',
      materials: p.materials || '',
      dailyCapacityMinutes: p.dailyCapacityMinutes,
      status: p.status,
      color: p.color || '',
      notes: p.notes || '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    try {
      const url = editingId ? `/api/impressoras/${editingId}` : '/api/impressoras'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Erro ao salvar.')
        return
      }
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Printer) {
    if (!confirm(`Excluir impressora "${p.name}"? Tarefas atribuídas a ela ficam sem máquina.`)) return
    const res = await fetch(`/api/impressoras/${p.id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('Erro ao excluir.')
      return
    }
    await load()
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin" style={{ color: '#6B7494', textDecoration: 'none' }}>← Voltar ao painel</Link>
      </div>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Impressoras</h1>
          <p style={{ color: '#6B7494', margin: '4px 0 0' }}>
            Cadastre cada impressora física da bancada. A capacidade total da produção é a soma das capacidades das impressoras ativas.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: 'pointer' }}
        >
          + Nova impressora
        </button>
      </header>

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando...</p>
      ) : items.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#6B7494' }}>
          Nenhuma impressora cadastrada. Clique em "Nova impressora" para começar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {items.map(p => {
            const status = STATUS_LABEL[p.status] || STATUS_LABEL.active
            return (
              <article key={p.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${p.color || status.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{p.name}</h2>
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: `${status.color}20`, color: status.color }}>
                    {status.label}
                  </span>
                </div>
                {p.model && <p style={{ fontSize: '13px', color: '#6B7494', margin: '0 0 4px' }}>{p.model}</p>}
                <div style={{ fontSize: '13px', color: '#3D4460', display: 'grid', gap: '4px', marginTop: '12px' }}>
                  {p.buildVolume && <div><strong>Volume:</strong> {p.buildVolume}</div>}
                  {p.materials && <div><strong>Materiais:</strong> {p.materials}</div>}
                  <div><strong>Capacidade:</strong> {p.dailyCapacityMinutes} min/dia ({(p.dailyCapacityMinutes / 60).toFixed(1)}h)</div>
                </div>
                {p.notes && <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '12px', whiteSpace: 'pre-wrap' }}>{p.notes}</p>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    onClick={() => openEdit(p)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #EF4444', background: 'white', color: '#B42318', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '90%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px' }}>{editingId ? 'Editar impressora' : 'Nova impressora'}</h2>

            <div style={{ display: 'grid', gap: '12px' }}>
              <Field label="Nome *">
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ex: Bambu A1 #1" style={inputStyle} />
              </Field>
              <Field label="Modelo">
                <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="ex: Bambu Lab A1 mini" style={inputStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Volume (mm)">
                  <input value={form.buildVolume} onChange={e => setForm({ ...form, buildVolume: e.target.value })} placeholder="180x180x180" style={inputStyle} />
                </Field>
                <Field label="Materiais">
                  <input value={form.materials} onChange={e => setForm({ ...form, materials: e.target.value })} placeholder="PLA, PETG" style={inputStyle} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Capacidade diária (min)">
                  <input type="number" min={0} value={form.dailyCapacityMinutes} onChange={e => setForm({ ...form, dailyCapacityMinutes: Math.max(0, Number(e.target.value) || 0) })} style={inputStyle} />
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Printer['status'] })} style={inputStyle}>
                    <option value="active">Ativa</option>
                    <option value="maintenance">Em manutenção</option>
                    <option value="offline">Desligada</option>
                  </select>
                </Field>
              </div>
              <Field label="Cor (hex)">
                <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="#1D7A72" style={inputStyle} />
              </Field>
              <Field label="Notas">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </Field>
            </div>

            {error && <p role="alert" style={{ color: '#B42318', marginTop: '12px', fontSize: '13px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" disabled={saving} onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar'}
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#1D2235' }}>
      {label}
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
}
