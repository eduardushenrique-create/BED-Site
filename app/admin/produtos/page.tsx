'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import ProductGalleryEditor from '@/components/admin/ProductGalleryEditor'
import ProductVariantsEditor from '@/components/admin/ProductVariantsEditor'
import ProductBomManager from '@/components/admin/ProductBomManager'
import ProductCostCalculator from '@/components/admin/ProductCostCalculator'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  slug: string
  price: number
  categories: string[]
  description: string
  isActive: boolean
  isFeatured: boolean
  isPersonalizable: boolean
  status: string
  stock: number
  underOrder: boolean
  sku?: string
  productionMinutesPerUnit?: number | null
  imageUrl?: string | null
  visibility?: 'public' | 'internal'
}

interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
}

type FilterKey = 'all' | 'published' | 'draft' | 'archived' | 'featured' | 'internal'
type ViewMode = 'cards' | 'list'

const LS_VIEW_KEY = 'admin.products.view'

const emptyForm = {
  name: '',
  price: '',
  categories: [] as string[],
  description: '',
  stock: '0',
  underOrder: false,
  sku: '',
  isPersonalizable: false,
  isFeatured: false,
  productionMinutesPerUnit: '',
  visibility: 'public' as 'public' | 'internal',
}

// ─── StatusPill ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  published: { label: 'Publicado', bg: '#DFF4EC', color: '#1D7A72' },
  draft:     { label: 'Rascunho',  bg: '#FEF3C7', color: '#92400E' },
  archived:  { label: 'Arquivado', bg: '#E7EDF8', color: '#6B7494' },
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '999px',
      fontSize: '12px', fontWeight: 700,
      backgroundColor: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

// ─── ViewToggle ─────────────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #E3E9F4', overflow: 'hidden', flexShrink: 0 }}>
      {(['cards', 'list'] as ViewMode[]).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            padding: '8px 14px', fontSize: '13px', fontWeight: 600,
            border: 'none', cursor: 'pointer',
            backgroundColor: view === v ? '#1D2235' : 'white',
            color: view === v ? 'white' : '#6B7494',
          }}
        >
          {v === 'cards' ? '⊞ Cards' : '☰ Lista'}
        </button>
      ))}
    </div>
  )
}

// ─── Stepper ────────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Básico', 'Galeria', 'Variações', 'BOM', 'Custo']

function Stepper({ current, enabled, onStep }: { current: number; enabled: number; onStep: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
      {STEP_LABELS.map((label, i) => {
        const isActive = i === current
        const isDone = i < current
        const isEnabled = i <= enabled
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 'none' }}>
            <button
              type="button"
              onClick={() => isEnabled && onStep(i)}
              disabled={!isEnabled}
              aria-current={isActive ? 'step' : undefined}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: isEnabled ? 'pointer' : 'default',
                padding: '0 4px', minWidth: '72px',
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
                backgroundColor: isDone ? '#1D7A72' : isActive ? '#1D2235' : '#E3E9F4',
                color: isDone || isActive ? 'white' : '#A8AFCA',
                outline: isActive ? '2px solid #4A7AB5' : 'none',
                outlineOffset: '2px',
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '12px', fontWeight: isActive ? 700 : 500,
                color: isActive ? '#1D2235' : isDone ? '#1D7A72' : '#A8AFCA',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <div style={{
                flex: 1, height: '2px',
                backgroundColor: isDone ? '#1D7A72' : '#E3E9F4',
                margin: '0 4px', marginBottom: '18px',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── ProductCard ────────────────────────────────────────────────────────────────

function ProductCard({
  product, onEdit, onDelete, onToggleStatus,
}: {
  product: Product
  onEdit: () => void
  onDelete: () => void
  onToggleStatus: () => void
}) {
  const status = product.status || (product.isActive ? 'published' : 'draft')
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={e => e.key === 'Enter' && onEdit()}
      style={{
        background: 'white', borderRadius: '12px', border: '1px solid #E3E9F4',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 1px 4px rgba(29,34,53,0.06)', cursor: 'pointer',
      }}
    >
      {/* Thumb 4:3 */}
      <div style={{ position: 'relative', aspectRatio: '4/3', background: '#F0F5FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: '40px', color: '#D8DCE8' }}>□</span>
        }
        <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
          <StatusPill status={status} />
        </div>
        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          {product.isFeatured && (
            <div style={{ background: '#D4849A', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
              Destaque
            </div>
          )}
          {product.visibility === 'internal' && (
            <div style={{ background: '#6B7494', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
              Interno
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1D2235', lineHeight: 1.3 }}>{product.name}</div>
        {product.sku && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#A8AFCA' }}>{product.sku}</div>
        )}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: '#1D2235', marginTop: '4px' }}>
          R$ {product.price.toFixed(2).replace('.', ',')}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: product.underOrder ? '#A3526A' : product.stock > 0 ? '#1D7A72' : '#B42318' }}>
          {product.underOrder ? 'Sob encomenda' : `${product.stock} em estoque`}
        </div>
      </div>

      {/* Footer actions */}
      <div
        style={{ padding: '10px 16px', borderTop: '1px solid #F0F5FB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={onToggleStatus}
            style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', border: '1px solid #E3E9F4', background: 'white', cursor: 'pointer', color: '#6B7494' }}
          >
            {product.isActive ? 'Desativar' : 'Ativar'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', border: '1px solid #F5D0D9', background: 'white', cursor: 'pointer', color: '#A3526A' }}
          >
            Excluir
          </button>
        </div>
        <button
          type="button"
          onClick={onEdit}
          style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#1D2235', color: 'white', cursor: 'pointer' }}
        >
          Editar →
        </button>
      </div>
    </div>
  )
}

function NewProductCard({ onCreate }: { onCreate: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onCreate}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'white', borderRadius: '12px',
        border: `2px dashed ${hover ? '#4A7AB5' : '#D8DCE8'}`,
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '12px', minHeight: '200px',
        color: hover ? '#4A7AB5' : '#A8AFCA',
        fontSize: '14px', fontWeight: 600,
        transition: 'border-color 150ms, color 150ms',
      }}
    >
      <span style={{ fontSize: '32px' }}>+</span>
      Novo produto
    </button>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [view, setView] = useState<ViewMode>('cards')
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_VIEW_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'cards' || saved === 'list') setView(saved)
    } catch {}
  }, [])

  const handleViewChange = (v: ViewMode) => {
    setView(v)
    try { localStorage.setItem(LS_VIEW_KEY, v) } catch {}
  }

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await fetch('/api/produtos')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/categorias')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data.filter((c: Category) => c.isActive) : [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const counts = {
    all: products.length,
    published: products.filter(p => p.status === 'published' || p.isActive).length,
    draft: products.filter(p => p.status === 'draft' || (!p.isActive && p.status !== 'archived')).length,
    archived: products.filter(p => p.status === 'archived').length,
    featured: products.filter(p => p.isFeatured).length,
    internal: products.filter(p => p.visibility === 'internal').length,
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false
    if (activeFilter === 'all') return true
    if (activeFilter === 'published') return p.status === 'published' || p.isActive
    if (activeFilter === 'draft') return p.status === 'draft' || (!p.isActive && p.status !== 'archived')
    if (activeFilter === 'archived') return p.status === 'archived'
    if (activeFilter === 'featured') return p.isFeatured
    if (activeFilter === 'internal') return p.visibility === 'internal'
    return true
  })

  const resetEditor = () => {
    setShowEditor(false)
    setEditingId(null)
    setFormData(emptyForm)
    setCurrentStep(0)
  }

  const openNew = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setCurrentStep(0)
    setShowEditor(true)
  }

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: String(product.price),
      categories: Array.isArray(product.categories) ? product.categories : [],
      description: product.description || '',
      stock: String(product.stock),
      underOrder: product.underOrder || false,
      sku: product.sku || '',
      isPersonalizable: product.isPersonalizable,
      isFeatured: product.isFeatured,
      productionMinutesPerUnit:
        typeof product.productionMinutesPerUnit === 'number' && product.productionMinutesPerUnit > 0
          ? String(product.productionMinutesPerUnit)
          : '',
      visibility: product.visibility ?? 'public',
    })
    setEditingId(product.id)
    setCurrentStep(0)
    setShowEditor(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.price || formData.categories.length === 0) {
      alert('Preencha nome, preço e ao menos uma categoria.')
      return
    }

    const slug = formData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')

    const productionMinutes = formData.productionMinutesPerUnit
      ? Number(formData.productionMinutesPerUnit)
      : undefined

    const productData = {
      name: formData.name,
      slug,
      price: parseFloat(formData.price),
      categories: formData.categories,
      description: formData.description,
      isPersonalizable: formData.isPersonalizable,
      isFeatured: formData.isFeatured,
      isActive: true,
      status: 'published',
      stock: parseInt(formData.stock, 10) || 0,
      underOrder: formData.underOrder,
      sku: formData.sku,
      visibility: formData.visibility,
      ...(typeof productionMinutes === 'number' && Number.isFinite(productionMinutes) && productionMinutes > 0
        ? { productionMinutesPerUnit: productionMinutes }
        : { productionMinutesPerUnit: null }),
    }

    const wasCreating = !editingId
    try {
      const res = await fetch('/api/produtos', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...productData } : productData),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Erro ao salvar produto.')
        return
      }
      const created = await res.json().catch(() => null)
      await loadProducts()
      if (wasCreating && created?.id) {
        setEditingId(created.id)
        setCurrentStep(1)
      } else {
        resetEditor()
      }
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Erro ao salvar produto. Verifique sua conexão e tente novamente.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto?')) return
    try {
      await fetch(`/api/produtos?id=${id}`, { method: 'DELETE' })
      loadProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
    }
  }

  const handleToggleStatus = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    try {
      await fetch('/api/produtos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !product.isActive, status: product.isActive ? 'draft' : 'published' }),
      })
      loadProducts()
    } catch (error) {
      console.error('Error toggling status:', error)
    }
  }

  const handleToggleFeatured = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    try {
      await fetch('/api/produtos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isFeatured: !product.isFeatured }),
      })
      loadProducts()
    } catch (error) {
      console.error('Error toggling featured:', error)
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev =>
      prev.size === filteredProducts.length ? new Set() : new Set(filteredProducts.map(p => p.id))
    )
  }

  function clearSelection() { setSelectedIds(new Set()) }

  async function applyBulk(updates: Record<string, unknown>, confirmMessage?: string) {
    if (selectedIds.size === 0) return
    if (confirmMessage && !confirm(confirmMessage)) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/produtos/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data?.error || 'Erro ao aplicar alterações em massa.'); return }
      clearSelection()
      await loadProducts()
    } finally {
      setBulkBusy(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>
  }

  // ─── EDITOR VIEW ──────────────────────────────────────────────────────────────

  if (showEditor) {
    const enabledStep = editingId ? 4 : 0

    return (
      <div>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A7AB5', marginBottom: '4px' }}>
              Admin · Catálogo
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235', margin: 0 }}>
              {editingId ? 'Editar produto' : 'Novo produto'}
            </h1>
          </div>
          <Button variant="outline" onClick={resetEditor}>← Voltar</Button>
        </header>

        <Stepper current={currentStep} enabled={enabledStep} onStep={setCurrentStep} />

        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 24px rgba(29,34,53,0.08)' }}>

          {/* Bloqueio para passos 2-5 sem produto salvo */}
          {currentStep >= 1 && !editingId && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#A8AFCA' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#6B7494', marginBottom: '20px' }}>
                Salve o produto primeiro para liberar este passo.
              </p>
              <Button variant="blue" onClick={() => setCurrentStep(0)}>← Voltar ao básico</Button>
            </div>
          )}

          {/* Passo 1: Básico */}
          {currentStep === 0 && (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1D2235', marginBottom: '24px' }}>
                Informações básicas
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <Input
                  label="Nome do produto"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Porta-retratos"
                />
                <Input
                  label="Preço"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  required
                  placeholder="89.90"
                />
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#1D2235' }}>
                    Categorias
                  </label>
                  {categories.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#B42318' }}>
                      Cadastre categorias ativas antes de criar produtos.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #D8DCE8', backgroundColor: 'white', maxHeight: '160px', overflowY: 'auto' }}>
                      {categories.map(c => {
                        const checked = formData.categories.includes(c.slug)
                        return (
                          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#1D2235' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? formData.categories.filter(s => s !== c.slug)
                                  : [...formData.categories, c.slug]
                                setFormData({ ...formData, categories: next })
                              }}
                            />
                            {c.name}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {formData.categories.length === 0 && categories.length > 0 && (
                    <p style={{ marginTop: '6px', fontSize: '12px', color: '#B42318' }}>
                      Selecione ao menos uma categoria.
                    </p>
                  )}
                </div>
                <div>
                  <Input
                    label="Estoque"
                    type="number"
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                  />
                  <p style={{ marginTop: '6px', fontSize: '12px', color: '#6B7494', lineHeight: 1.4 }}>
                    Com variações ativas, o estoque é gerenciado por variação.
                  </p>
                </div>
                <Input
                  label="SKU"
                  value={formData.sku}
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Código SKU (opcional)"
                />
                <Input
                  label="Tempo estimado por unidade (min)"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.productionMinutesPerUnit}
                  onChange={e => setFormData({ ...formData, productionMinutesPerUnit: e.target.value })}
                  placeholder="Opcional. Ex: 90"
                />
              </div>

              <div style={{ marginTop: '16px' }}>
                <Input
                  label="Descrição"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do produto"
                />
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                  <input type="checkbox" checked={formData.isPersonalizable} onChange={e => setFormData({ ...formData, isPersonalizable: e.target.checked })} />
                  Personalizável
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                  <input type="checkbox" checked={formData.isFeatured} onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })} />
                  Em destaque
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                  <input type="checkbox" checked={formData.underOrder} onChange={e => setFormData({ ...formData, underOrder: e.target.checked })} />
                  Sob encomenda
                </label>
              </div>

              <div style={{ marginTop: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1D2235', marginBottom: '10px' }}>Visibilidade</div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={formData.visibility === 'public'}
                      onChange={() => setFormData({ ...formData, visibility: 'public' })}
                    />
                    Público — aparece na loja
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                    <input
                      type="radio"
                      name="visibility"
                      value="internal"
                      checked={formData.visibility === 'internal'}
                      onChange={() => setFormData({ ...formData, visibility: 'internal' })}
                    />
                    Interno — só admin pode usar em pedidos
                  </label>
                </div>
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#6B7494', lineHeight: 1.5 }}>
                  Produtos internos não aparecem na loja, busca, sitemap ou recomendações. Use para itens de revenda, brindes, kits sob encomenda ou ajustes manuais.
                </p>
              </div>

              <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
                <Button type="submit" variant="blue" disabled={!categories.length}>
                  {editingId ? 'Salvar e continuar →' : 'Criar produto →'}
                </Button>
                <Button type="button" variant="outline" onClick={resetEditor}>Cancelar</Button>
              </div>
            </form>
          )}

          {/* Passo 2: Galeria */}
          {currentStep === 1 && editingId && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1D2235', marginBottom: '24px' }}>Galeria de imagens</h2>
              <ProductGalleryEditor productId={editingId} />
            </div>
          )}

          {/* Passo 3: Variações */}
          {currentStep === 2 && editingId && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1D2235', marginBottom: '24px' }}>Variações</h2>
              <ProductVariantsEditor productId={editingId} />
            </div>
          )}

          {/* Passo 4: BOM */}
          {currentStep === 3 && editingId && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1D2235', marginBottom: '24px' }}>Componentes (BOM)</h2>
              <ProductBomManager productId={editingId} />
            </div>
          )}

          {/* Passo 5: Custo */}
          {currentStep === 4 && editingId && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1D2235', marginBottom: '24px' }}>Calculadora de custo</h2>
              <ProductCostCalculator productId={editingId} />
            </div>
          )}

          {/* Navegação entre passos */}
          {currentStep > 0 && editingId && (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #E3E9F4', display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="outline" onClick={() => setCurrentStep(s => s - 1)}>← Anterior</Button>
              {currentStep < 4
                ? <Button variant="blue" onClick={() => setCurrentStep(s => s + 1)}>Próximo →</Button>
                : <Button variant="blue" onClick={resetEditor}>Concluir</Button>
              }
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: 'Todos' },
    { key: 'published', label: 'Publicados' },
    { key: 'draft',     label: 'Rascunhos' },
    { key: 'archived',  label: 'Arquivados' },
    { key: 'featured',  label: 'Em destaque' },
    { key: 'internal',  label: 'Internos' },
  ]

  const allSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length
  const hasSelection = selectedIds.size > 0

  return (
    <div>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A7AB5', marginBottom: '4px' }}>
            Admin · Catálogo
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235', margin: '0 0 4px' }}>Produtos</h1>
          <p style={{ color: '#6B7494', fontSize: '14px', margin: 0 }}>
            {counts.all} produto{counts.all !== 1 ? 's' : ''} ·{' '}
            {counts.published} publicado{counts.published !== 1 ? 's' : ''} ·{' '}
            {counts.draft} rascunho{counts.draft !== 1 ? 's' : ''} ·{' '}
            {counts.archived} arquivado{counts.archived !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="blue" onClick={openNew}>+ Novo produto</Button>
      </header>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '7px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                borderColor: activeFilter === f.key ? '#1D2235' : '#E3E9F4',
                background: activeFilter === f.key ? '#1D2235' : 'white',
                color: activeFilter === f.key ? 'white' : '#6B7494',
              }}
            >
              {f.label}{activeFilter !== f.key && counts[f.key] > 0 ? ` ${counts[f.key]}` : ''}
            </button>
          ))}
        </div>
        <ViewToggle view={view} onChange={handleViewChange} />
      </div>

      {/* Bulk bar (lista densa) */}
      {view === 'list' && hasSelection && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '14px 16px', background: '#1D2235', color: 'white', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {selectedIds.size} produto{selectedIds.size > 1 ? 's' : ''} selecionado{selectedIds.size > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isActive: true, status: 'published' })} style={bulkBtn}>Ativar</button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isActive: false, status: 'draft' })} style={bulkBtn}>Desativar</button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isFeatured: true })} style={bulkBtn}>Destacar</button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isFeatured: false })} style={bulkBtn}>Tirar destaque</button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isPersonalizable: true })} style={bulkBtn}>Personalizável</button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isPersonalizable: false })} style={bulkBtn}>Tirar personalizável</button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ underOrder: true })} style={bulkBtn}>Sob encomenda</button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ underOrder: false })} style={bulkBtn}>Tirar sob encomenda</button>
            <button type="button" onClick={clearSelection} disabled={bulkBusy} style={{ ...bulkBtn, background: 'rgba(255,255,255,0.1)' }}>Limpar seleção</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredProducts.length === 0 && (
        <div style={{ background: 'white', borderRadius: '16px', padding: '48px', textAlign: 'center', boxShadow: '0 4px 24px rgba(29,34,53,0.06)' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>
            {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado com esses filtros'}
          </p>
          {products.length === 0 && <Button variant="blue" onClick={openNew}>+ Cadastrar primeiro produto</Button>}
        </div>
      )}

      {/* Cards view */}
      {view === 'cards' && filteredProducts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => handleEdit(product)}
              onDelete={() => handleDelete(product.id)}
              onToggleStatus={() => handleToggleStatus(product.id)}
            />
          ))}
          <NewProductCard onCreate={openNew} />
        </div>
      )}

      {/* Lista densa */}
      {view === 'list' && filteredProducts.length > 0 && (
        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(29,34,53,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
                <th style={{ padding: '14px 16px', width: '40px' }}>
                  <input type="checkbox" aria-label="Selecionar todos" checked={allSelected} onChange={toggleSelectAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#6B7494' }}>Produto</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#6B7494' }}>Categoria</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#6B7494' }}>Preço</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#6B7494' }}>Estoque</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#6B7494' }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#6B7494' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const status = product.status || (product.isActive ? 'published' : 'draft')
                return (
                  <tr
                    key={product.id}
                    onClick={() => handleEdit(product)}
                    style={{ borderBottom: '1px solid #F0F5FB', background: selectedIds.has(product.id) ? '#FAFCFE' : 'white', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FBFE')}
                    onMouseLeave={e => (e.currentTarget.style.background = selectedIds.has(product.id) ? '#FAFCFE' : 'white')}
                  >
                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${product.name}`}
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelected(product.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F0F5FB', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {product.imageUrl
                            ? <img src={product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: '16px', color: '#D8DCE8' }}>□</span>
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1D2235' }}>{product.name}</div>
                          {product.sku && (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#A8AFCA' }}>{product.sku}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '14px', color: '#6B7494', textTransform: 'capitalize' }}>{(product.categories ?? []).join(', ')}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '14px', color: '#1D2235' }}>
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {product.underOrder ? (
                        <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: '#FCEBF0', color: '#A3526A' }}>
                          Sob encomenda
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: '14px', color: product.stock > 5 ? '#1D7A72' : product.stock > 0 ? '#92400E' : '#B42318' }}>
                          {product.stock} un
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusPill status={status} />
                    </td>
                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1D2235' }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const bulkBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.16)',
  color: 'white',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
}
