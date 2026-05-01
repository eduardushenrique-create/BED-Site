'use client'

import { useEffect, useMemo, useState } from 'react'

type Coupon = {
  id: string
  code: string
  type: 'fixed' | 'percentage'
  value: number
  minSubtotal: number | null
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
}

type FormState = {
  id: string | null
  code: string
  type: 'fixed' | 'percentage'
  value: string
  minSubtotal: string
  startsAt: string
  endsAt: string
  usageLimit: string
  isActive: boolean
}

const emptyForm: FormState = {
  id: null,
  code: '',
  type: 'percentage',
  value: '',
  minSubtotal: '',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  isActive: true,
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return ''
    const offsetMs = d.getTimezoneOffset() * 60 * 1000
    const local = new Date(d.getTime() - offsetMs)
    return local.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

function fromLocalDateTimeInput(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString()
}

function formatBRL(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function AdminCuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCoupons()
  }, [])

  async function loadCoupons() {
    setLoading(true)
    try {
      const res = await fetch('/api/cupons', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCoupons(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading coupons:', err)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function openEdit(coupon: Coupon) {
    setForm({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minSubtotal: coupon.minSubtotal != null ? String(coupon.minSubtotal) : '',
      startsAt: toLocalDateTimeInput(coupon.startsAt),
      endsAt: toLocalDateTimeInput(coupon.endsAt),
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      isActive: coupon.isActive,
    })
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setForm(emptyForm)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minSubtotal: form.minSubtotal === '' ? null : Number(form.minSubtotal),
      startsAt: fromLocalDateTimeInput(form.startsAt),
      endsAt: fromLocalDateTimeInput(form.endsAt),
      usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
      isActive: form.isActive,
    }

    try {
      const isEdit = Boolean(form.id)
      const res = await fetch('/api/cupons', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: form.id, ...payload } : payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Erro ao salvar cupom.')
        return
      }
      closeForm()
      loadCoupons()
    } catch (err) {
      console.error('Error saving coupon:', err)
      setError('Erro ao salvar cupom.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(coupon: Coupon) {
    try {
      await fetch('/api/cupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, isActive: !coupon.isActive }),
      })
      loadCoupons()
    } catch (err) {
      console.error('Error toggling coupon:', err)
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Excluir cupom ${coupon.code}? Esta ação não pode ser desfeita.`)) return
    try {
      await fetch(`/api/cupons?id=${coupon.id}`, { method: 'DELETE' })
      loadCoupons()
    } catch (err) {
      console.error('Error deleting coupon:', err)
    }
  }

  const sortedCoupons = useMemo(() => coupons, [coupons])

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #D8DCE8',
    background: 'white',
    color: '#1D2235',
    fontSize: '14px',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = { display: 'grid', gap: '6px', fontSize: '13px', color: '#1D2235', fontWeight: 600 }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Cupons</h1>
          <p style={{ color: '#6B7494', marginTop: '6px' }}>Gerencie cupons de desconto aplicáveis no checkout.</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #1D2235', background: '#1D2235', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            + Novo cupom
          </button>
        )}
      </header>

      {showForm && (
        <section style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: 0, marginBottom: '16px' }}>
            {form.id ? 'Editar cupom' : 'Novo cupom'}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <label style={labelStyle}>
                Código *
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  required
                  style={{ ...inputStyle, textTransform: 'uppercase' }}
                />
              </label>
              <label style={labelStyle}>
                Tipo *
                <select
                  value={form.type}
                  onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as 'fixed' | 'percentage' }))}
                  style={inputStyle}
                >
                  <option value="percentage">Porcentagem (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </label>
              <label style={labelStyle}>
                Valor *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={form.type === 'percentage' ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Subtotal mínimo (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.minSubtotal}
                  onChange={(e) => setForm(prev => ({ ...prev, minSubtotal: e.target.value }))}
                  placeholder="opcional"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Limite de uso
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={form.usageLimit}
                  onChange={(e) => setForm(prev => ({ ...prev, usageLimit: e.target.value }))}
                  placeholder="opcional"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Início
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm(prev => ({ ...prev, startsAt: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Término
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm(prev => ({ ...prev, endsAt: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ ...labelStyle, alignItems: 'start', justifyContent: 'center' }}>
                Status
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Ativo
                </label>
              </label>
            </div>

            {error && <p role="alert" style={{ color: '#A3526A', margin: 0 }}>{error}</p>}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeForm}
                style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #D8DCE8', background: 'white', color: '#1D2235', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #1D2235', background: '#1D2235', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Salvando...' : (form.id ? 'Salvar alterações' : 'Criar cupom')}
              </button>
            </div>
          </form>
        </section>
      )}

      {sortedCoupons.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: '18px', color: '#6B7494', margin: 0 }}>Nenhum cupom cadastrado.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#F0F5FB', color: '#1D2235' }}>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Código</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Valor</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Mín. subtotal</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Validade</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Usos</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '14px 16px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedCoupons.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #E3E9F4', color: '#1D2235' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>{c.code}</td>
                    <td style={{ padding: '14px 16px' }}>{c.type === 'percentage' ? 'Porcentagem' : 'Valor fixo'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {c.type === 'percentage' ? `${c.value}%` : formatBRL(c.value)}
                    </td>
                    <td style={{ padding: '14px 16px', color: c.minSubtotal != null ? '#1D2235' : '#6B7494' }}>
                      {c.minSubtotal != null ? formatBRL(c.minSubtotal) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7494' }}>
                      <div>Início: {formatDate(c.startsAt)}</div>
                      <div>Fim: {formatDate(c.endsAt)}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {c.usedCount} {c.usageLimit != null ? `/ ${c.usageLimit}` : ''}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: c.isActive ? '#10B981' : '#6B7280',
                        color: 'white',
                      }}>
                        {c.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', color: '#1D2235', cursor: 'pointer', fontSize: '13px' }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggle(c)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', color: '#1D2235', cursor: 'pointer', fontSize: '13px' }}
                        >
                          {c.isActive ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #EF4444', background: 'white', color: '#EF4444', cursor: 'pointer', fontSize: '13px' }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
