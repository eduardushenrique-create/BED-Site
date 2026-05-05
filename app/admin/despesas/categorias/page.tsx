'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  defaultType: string | null
  costCenter: string | null
  color: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type FormData = {
  name: string
  slug: string
  description: string
  defaultType: string
  costCenter: string
  color: string
  isActive: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const EMPTY_FORM: FormData = {
  name: '',
  slug: '',
  description: '',
  defaultType: '',
  costCenter: '',
  color: '#6B7494',
  isActive: true,
}

const TYPE_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'fixed', label: 'Fixo' },
  { value: 'variable', label: 'Variavel' },
  { value: 'one_time', label: 'Pontual' },
]

const COST_CENTER_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'producao', label: 'Producao' },
  { value: 'logistica', label: 'Logistica' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'outros', label: 'Outros' },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  background: 'white',
  color: '#1D2235',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#1D2235',
  display: 'block',
  marginBottom: '6px',
}

function CategoryForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  saving,
  apiError,
}: {
  initial: FormData
  onSubmit: (data: FormData) => Promise<void>
  onCancel: () => void
  submitLabel: string
  saving: boolean
  apiError: string
}) {
  const [form, setForm] = useState<FormData>(initial)

  // Reset form when initial changes (e.g. switching between edit targets)
  useEffect(() => {
    setForm(initial)
  }, [initial])

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      // Only auto-generate slug when it's blank or was previously auto-generated from the name
      slug: generateSlug(name),
    }))
  }

  function handleChange<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'white',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        marginBottom: '24px',
      }}
    >
      {apiError && (
        <div
          style={{
            background: '#FEE2E2',
            color: '#B42318',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          {apiError}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        {/* Name */}
        <div>
          <label htmlFor="cat-name" style={labelStyle}>
            Nome <span style={{ color: '#B42318' }}>*</span>
          </label>
          <input
            id="cat-name"
            type="text"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="Ex: Insumos de impressao"
            style={inputStyle}
          />
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="cat-slug" style={labelStyle}>
            Slug <span style={{ color: '#B42318' }}>*</span>
          </label>
          <input
            id="cat-slug"
            type="text"
            value={form.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            required
            placeholder="Ex: insumos-impressao"
            style={inputStyle}
          />
        </div>

        {/* Default Type */}
        <div>
          <label htmlFor="cat-type" style={labelStyle}>
            Tipo Padrao
          </label>
          <select
            id="cat-type"
            value={form.defaultType}
            onChange={(e) => handleChange('defaultType', e.target.value)}
            style={inputStyle}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Cost Center */}
        <div>
          <label htmlFor="cat-costcenter" style={labelStyle}>
            Centro de Custo
          </label>
          <select
            id="cat-costcenter"
            value={form.costCenter}
            onChange={(e) => handleChange('costCenter', e.target.value)}
            style={inputStyle}
          >
            {COST_CENTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div>
          <label htmlFor="cat-color" style={labelStyle}>
            Cor
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              id="cat-color"
              type="color"
              value={form.color || '#6B7494'}
              onChange={(e) => handleChange('color', e.target.value)}
              style={{
                width: '44px',
                height: '40px',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid #D8DCE8',
                cursor: 'pointer',
                background: 'white',
                flexShrink: 0,
              }}
              title="Selecionar cor"
            />
            <input
              type="text"
              value={form.color}
              onChange={(e) => handleChange('color', e.target.value)}
              placeholder="#6B7494"
              maxLength={7}
              style={{ ...inputStyle, flex: 1 }}
              aria-label="Hex da cor"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="cat-description" style={labelStyle}>
            Descricao
          </label>
          <input
            id="cat-description"
            type="text"
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Descricao opcional"
            style={inputStyle}
          />
        </div>
      </div>

      {/* isActive */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: 'fit-content' }}
        >
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => handleChange('isActive', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1D2235' }}>
            Categoria ativa
          </span>
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            background: '#1D2235',
            color: 'white',
            fontWeight: 600,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            background: 'white',
            color: '#1D2235',
            fontWeight: 600,
            border: '1px solid #D8DCE8',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CategoriasDespesasPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/despesas/categorias?includeInactive=true', {
        cache: 'no-store',
      })
      if (!res.ok) {
        setError('Erro ao carregar categorias.')
        return
      }
      const json = await res.json()
      setCategories(Array.isArray(json.categories) ? json.categories : [])
    } catch {
      setError('Erro de conexao.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(data: FormData) {
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/despesas/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          slug: data.slug.trim(),
          description: data.description.trim() || null,
          defaultType: data.defaultType || null,
          costCenter: data.costCenter || null,
          color: data.color || null,
          isActive: data.isActive,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setFormError(json.error ?? 'Erro ao criar categoria.')
        return
      }
      setShowCreate(false)
      await load()
    } catch {
      setFormError('Erro de conexao.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(data: FormData) {
    if (!editingId) return
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch(`/api/despesas/categorias/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          slug: data.slug.trim(),
          description: data.description.trim() || null,
          defaultType: data.defaultType || null,
          costCenter: data.costCenter || null,
          color: data.color || null,
          isActive: data.isActive,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setFormError(json.error ?? 'Erro ao salvar categoria.')
        return
      }
      setEditingId(null)
      await load()
    } catch {
      setFormError('Erro de conexao.')
    } finally {
      setSaving(false)
    }
  }

  const editingCategory = editingId ? categories.find((c) => c.id === editingId) : null

  const editingInitial: FormData = editingCategory
    ? {
        name: editingCategory.name,
        slug: editingCategory.slug,
        description: editingCategory.description ?? '',
        defaultType: editingCategory.defaultType ?? '',
        costCenter: editingCategory.costCenter ?? '',
        color: editingCategory.color ?? '#6B7494',
        isActive: editingCategory.isActive,
      }
    : EMPTY_FORM

  return (
    <div>
      <header style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Link
            href="/admin/despesas"
            style={{ color: '#4A7AB5', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}
          >
            Despesas
          </Link>
          <span style={{ color: '#6B7494', fontSize: '13px' }}>/</span>
          <span style={{ color: '#6B7494', fontSize: '13px' }}>Categorias</span>
        </div>
        <p
          style={{
            fontSize: '12px',
            color: '#4A7AB5',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Financeiro
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{ fontSize: 'clamp(22px, 3vw, 30px)', color: '#1D2235', margin: '6px 0 4px' }}
            >
              Categorias de Despesas
            </h1>
            <p style={{ color: '#6B7494', margin: 0 }}>
              Organize despesas por categoria para melhores relatorios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setFormError('')
              setShowCreate((v) => !v)
            }}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: '#1D2235',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              flexShrink: 0,
            }}
          >
            {showCreate ? 'Cancelar' : '+ Nova Categoria'}
          </button>
        </div>
      </header>

      {/* Owner notice */}
      <div
        role="note"
        style={{
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '14px',
          color: '#92400E',
        }}
      >
        Criacao e edicao de categorias disponivel apenas para proprietarios.
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#FEE2E2',
            color: '#B42318',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={load}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #FCA5A5',
              background: 'white',
              color: '#B42318',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <CategoryForm
          initial={EMPTY_FORM}
          onSubmit={handleCreate}
          onCancel={() => {
            setShowCreate(false)
            setFormError('')
          }}
          submitLabel="Criar Categoria"
          saving={saving}
          apiError={formError}
        />
      )}

      {/* Edit form */}
      {editingId && (
        <CategoryForm
          initial={editingInitial}
          onSubmit={handleEdit}
          onCancel={() => {
            setEditingId(null)
            setFormError('')
          }}
          submitLabel="Salvar Alteracoes"
          saving={saving}
          apiError={formError}
        />
      )}

      {/* Loading skeleton */}
      {loading && !categories.length && (
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '48px',
                background: '#E3E9F4',
                borderRadius: '8px',
                marginBottom: '12px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && categories.length === 0 && (
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <p style={{ color: '#6B7494', margin: '0 0 16px', fontSize: '16px' }}>
            Nenhuma categoria cadastrada ainda.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#1D2235',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Criar primeira categoria
          </button>
        </div>
      )}

      {/* Category table */}
      {!loading && categories.length > 0 && (
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Cor', 'Nome', 'Tipo Padrao', 'Centro de Custo', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#6B7494',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        textAlign: 'left',
                        borderBottom: '1px solid #E3E9F4',
                        background: '#F7F9FC',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    style={{
                      background: editingId === cat.id ? '#F0F5FB' : 'transparent',
                    }}
                  >
                    {/* Color dot */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0F3FA' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: cat.color ?? '#6B7494',
                          border: '1px solid rgba(0,0,0,0.1)',
                          verticalAlign: 'middle',
                        }}
                        title={cat.color ?? undefined}
                      />
                    </td>
                    {/* Name */}
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #F0F3FA',
                        fontWeight: 600,
                        color: '#1D2235',
                        fontSize: '14px',
                      }}
                    >
                      {cat.name}
                      {cat.description && (
                        <span
                          style={{ display: 'block', fontSize: '12px', color: '#6B7494', fontWeight: 400 }}
                        >
                          {cat.description}
                        </span>
                      )}
                    </td>
                    {/* Default type */}
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #F0F3FA',
                        fontSize: '13px',
                        color: '#6B7494',
                      }}
                    >
                      {cat.defaultType
                        ? TYPE_OPTIONS.find((o) => o.value === cat.defaultType)?.label ??
                          cat.defaultType
                        : '—'}
                    </td>
                    {/* Cost center */}
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #F0F3FA',
                        fontSize: '13px',
                        color: '#6B7494',
                      }}
                    >
                      {cat.costCenter
                        ? COST_CENTER_OPTIONS.find((o) => o.value === cat.costCenter)?.label ??
                          cat.costCenter
                        : '—'}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0F3FA' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: cat.isActive ? '#D1FAE5' : '#F3F4F6',
                          color: cat.isActive ? '#065F46' : '#6B7280',
                        }}
                      >
                        {cat.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    {/* Edit action */}
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #F0F3FA',
                        textAlign: 'right',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreate(false)
                          setFormError('')
                          setEditingId(editingId === cat.id ? null : cat.id)
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #D8DCE8',
                          background: editingId === cat.id ? '#E3E9F4' : 'white',
                          color: '#1D2235',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {editingId === cat.id ? 'Fechar' : 'Editar'}
                      </button>
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
