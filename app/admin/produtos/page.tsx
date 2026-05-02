'use client'

import { useEffect, useRef, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { compressImageToDataUrl, ImageUploadError } from '@/lib/image-upload'
import ProductGalleryEditor from '@/components/admin/ProductGalleryEditor'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  category: string
  description: string
  imageUrl: string
  isActive: boolean
  isFeatured: boolean
  isPersonalizable: boolean
  status: string
  stock: number
  underOrder: boolean
  sku?: string
  productionMinutesPerUnit?: number | null
}

interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
}

const emptyForm = {
  name: '',
  price: '',
  category: '',
  description: '',
  imageUrl: '',
  stock: '0',
  underOrder: false,
  sku: '',
  isPersonalizable: false,
  isFeatured: false,
  productionMinutesPerUnit: '',
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [imagePreview, setImagePreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setCategories(Array.isArray(data) ? data.filter((category: Category) => category.isActive) : [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setImagePreview('')
    setFormData(emptyForm)
  }

  const [imageProcessing, setImageProcessing] = useState(false)
  const [imageError, setImageError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImageError('')
    setImageProcessing(true)
    try {
      const compressed = await compressImageToDataUrl(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 })
      setImagePreview(compressed)
      setFormData(current => ({ ...current, imageUrl: compressed }))
    } catch (err) {
      const msg = err instanceof ImageUploadError ? err.message : 'Erro ao processar a imagem.'
      setImageError(msg)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setImageProcessing(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.name || !formData.price || !formData.category) {
      alert('Preencha nome, preco e categoria.')
      return
    }

    const slug = formData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')

    const productionMinutes = formData.productionMinutesPerUnit
      ? Number(formData.productionMinutesPerUnit)
      : undefined

    const productData = {
      name: formData.name,
      slug,
      price: parseFloat(formData.price),
      category: formData.category,
      description: formData.description,
      imageUrl: formData.imageUrl,
      isPersonalizable: formData.isPersonalizable,
      isFeatured: formData.isFeatured,
      isActive: true,
      status: 'published',
      stock: parseInt(formData.stock, 10) || 0,
      underOrder: formData.underOrder,
      sku: formData.sku,
      ...(typeof productionMinutes === 'number' && Number.isFinite(productionMinutes) && productionMinutes > 0
        ? { productionMinutesPerUnit: productionMinutes }
        : { productionMinutesPerUnit: null }),
    }

    try {
      const res = await fetch('/api/produtos', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...productData } : productData),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Erro ao salvar produto. Tente novamente.')
        return
      }

      resetForm()
      loadProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Erro ao salvar produto. Verifique sua conexão e tente novamente.')
    }
  }

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: String(product.price),
      category: product.category,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      stock: String(product.stock),
      underOrder: product.underOrder || false,
      sku: product.sku || '',
      isPersonalizable: product.isPersonalizable,
      isFeatured: product.isFeatured,
      productionMinutesPerUnit:
        typeof product.productionMinutesPerUnit === 'number' && product.productionMinutesPerUnit > 0
          ? String(product.productionMinutesPerUnit)
          : '',
    })
    setImagePreview(product.imageUrl || '')
    setEditingId(product.id)
    setShowForm(true)
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
    const product = products.find(item => item.id === id)
    if (!product) return

    try {
      await fetch('/api/produtos', {
        method: 'PUT',
        body: JSON.stringify({ id, isActive: !product.isActive, status: product.isActive ? 'draft' : 'published' }),
      })
      loadProducts()
    } catch (error) {
      console.error('Error toggling status:', error)
    }
  }

  const handleToggleFeatured = async (id: string) => {
    const product = products.find(item => item.id === id)
    if (!product) return

    try {
      await fetch('/api/produtos', {
        method: 'PUT',
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
    setSelectedIds(prev => {
      if (prev.size === filteredProducts.length) return new Set()
      return new Set(filteredProducts.map(p => p.id))
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

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
      if (!res.ok) {
        alert(data?.error || 'Erro ao aplicar alterações em massa.')
        return
      }
      clearSelection()
      await loadProducts()
    } finally {
      setBulkBusy(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>
  }

  const allSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length
  const hasSelection = selectedIds.size > 0

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235' }}>Produtos</h1>
          <p style={{ color: '#6B7494' }}>Gerencie seus produtos</p>
        </div>
        <Button variant={showForm ? 'outline' : 'blue'} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Cancelar' : '+ Novo Produto'}
        </Button>
      </header>

      <div style={{ marginBottom: '24px' }}>
        <Input placeholder="Buscar produtos..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: '#1D2235' }}>
            {editingId ? 'Editar produto' : 'Novo produto'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <Input label="Nome do produto" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required placeholder="Ex: Porta-retratos" />
              <Input label="Preco" type="number" step="0.01" value={formData.price} onChange={(event) => setFormData({ ...formData, price: event.target.value })} required placeholder="89.90" />
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>Categoria</label>
                <select
                  value={formData.category}
                  onChange={(event) => setFormData({ ...formData, category: event.target.value })}
                  required
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #D8DCE8', fontSize: '16px', color: '#1D2235', backgroundColor: 'white' }}
                >
                  <option value="">Selecione...</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.slug}>{category.name}</option>
                  ))}
                </select>
                {!categories.length && (
                  <p style={{ marginTop: '8px', fontSize: '13px', color: '#6B7494' }}>
                    Nenhuma categoria ativa foi encontrada no banco. Cadastre categorias antes de criar produtos.
                  </p>
                )}
              </div>
              <Input label="Estoque" type="number" value={formData.stock} onChange={(event) => setFormData({ ...formData, stock: event.target.value })} placeholder="0" />
              <Input label="SKU" value={formData.sku} onChange={(event) => setFormData({ ...formData, sku: event.target.value })} placeholder="Codigo SKU (opcional)" />
              <Input
                label="Tempo estimado por unidade (minutos)"
                type="number"
                min="0"
                step="1"
                value={formData.productionMinutesPerUnit}
                onChange={(event) => setFormData({ ...formData, productionMinutesPerUnit: event.target.value })}
                placeholder="Opcional. Ex: 90"
              />
            </div>

            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>Imagem do produto</label>
                <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: 'none' }} />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" disabled={imageProcessing} onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 16px', backgroundColor: '#F0F5FB', border: '1px solid #D8DCE8', borderRadius: '10px', cursor: imageProcessing ? 'not-allowed' : 'pointer', fontSize: '14px', color: '#1D2235', opacity: imageProcessing ? 0.6 : 1 }}>
                    {imageProcessing ? 'Processando...' : imagePreview ? 'Trocar imagem' : 'Selecionar imagem'}
                  </button>
                  {imagePreview && !imageProcessing && (
                    <button type="button" onClick={() => { setImagePreview(''); setFormData({ ...formData, imageUrl: '' }); setImageError('') }} style={{ padding: '10px 16px', backgroundColor: '#FCEBF0', border: '1px solid #D4849A', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', color: '#A3526A' }}>
                      Remover
                    </button>
                  )}
                </div>
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#6B7494' }}>
                  JPG, PNG ou WebP até 10 MB. A imagem é redimensionada automaticamente para 1600px.
                </p>
                {imageError && (
                  <p role="alert" style={{ marginTop: '6px', fontSize: '13px', color: '#A3526A', fontWeight: 600 }}>{imageError}</p>
                )}
                {imagePreview && (
                  <div style={{ marginTop: '12px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '12px', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
              <Input label="Ou URL da imagem" value={formData.imageUrl} onChange={(event) => { setFormData({ ...formData, imageUrl: event.target.value }); setImagePreview(event.target.value) }} placeholder="https://..." />
            </div>

            {editingId && (
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #EEF1F8' }}>
                <ProductGalleryEditor productId={editingId} />
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              <Input label="Descricao" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Descricao do produto" />
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                <input type="checkbox" checked={formData.isPersonalizable} onChange={(event) => setFormData({ ...formData, isPersonalizable: event.target.checked })} />
                <span>Personalizavel</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                <input type="checkbox" checked={formData.isFeatured} onChange={(event) => setFormData({ ...formData, isFeatured: event.target.checked })} />
                <span>Destaque</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                <input type="checkbox" checked={formData.underOrder} onChange={(event) => setFormData({ ...formData, underOrder: event.target.checked })} />
                <span>Sob encomenda</span>
              </label>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <Button type="submit" variant="blue" disabled={!categories.length}>{editingId ? 'Salvar' : 'Criar produto'}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {products.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '48px', textAlign: 'center', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>Nenhum produto cadastrado</p>
          <Button variant="blue" onClick={() => setShowForm(true)}>+ Cadastrar primeiro produto</Button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
          {hasSelection && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '14px 16px', background: '#1D2235', color: 'white', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {selectedIds.size} produto{selectedIds.size > 1 ? 's' : ''} selecionado{selectedIds.size > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isActive: true, status: 'published' })} style={bulkBtn}>Ativar</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isActive: false, status: 'draft' })} style={bulkBtn}>Desativar</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isFeatured: true })} style={bulkBtn}>Destacar</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isFeatured: false })} style={bulkBtn}>Tirar destaque</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isPersonalizable: true })} style={bulkBtn}>Marcar personalizável</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ isPersonalizable: false })} style={bulkBtn}>Tirar personalizável</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ underOrder: true })} style={bulkBtn}>Sob encomenda</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulk({ underOrder: false })} style={bulkBtn}>Tirar sob encomenda</button>
                <select
                  disabled={bulkBusy}
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value
                    e.target.value = ''
                    if (val) applyBulk({ category: val }, `Mover ${selectedIds.size} produto(s) para a categoria selecionada?`)
                  }}
                  style={{ ...bulkBtn, padding: '6px 10px' }}
                >
                  <option value="">Mudar categoria...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
                <button type="button" onClick={clearSelection} disabled={bulkBusy} style={{ ...bulkBtn, background: 'rgba(255,255,255,0.1)' }}>Limpar seleção</button>
              </div>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
                <th style={{ padding: '16px', textAlign: 'left', width: '40px' }}>
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Produto</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Categoria</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Preco</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Estoque</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Destaque</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} style={{ borderBottom: '1px solid #D8DCE8', background: selectedIds.has(product.id) ? '#FAFCFE' : 'white' }}>
                  <td style={{ padding: '16px' }}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${product.name}`}
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '16px', fontWeight: 500 }}>{product.name}</td>
                  <td style={{ padding: '16px', color: '#6B7494', textTransform: 'capitalize' }}>{product.category}</td>
                  <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>R$ {product.price.toFixed(2).replace('.', ',')}</td>
                  <td style={{ padding: '16px' }}>
                    {product.underOrder ? (
                      <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: '#FCEBF0', color: '#A3526A' }}>
                        Sob encomenda
                      </span>
                    ) : (
                      <span style={{ color: product.stock > 0 ? '#1D7A72' : '#B42318', fontWeight: 600 }}>
                        {product.stock} un
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button onClick={() => handleToggleStatus(product.id)} style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: product.isActive ? '#DFF4EC' : '#FDE8E8', color: product.isActive ? '#1D7A72' : '#B42318', border: 'none', cursor: 'pointer' }}>
                      {product.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button onClick={() => handleToggleFeatured(product.id)} style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: product.isFeatured ? '#FCEBF0' : '#E7EDF8', color: product.isFeatured ? '#A3526A' : '#6B7494', border: 'none', cursor: 'pointer' }}>
                      {product.isFeatured ? 'Sim' : 'Nao'}
                    </button>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(product)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', color: '#1D2235' }}>Editar</button>
                      <button onClick={() => handleDelete(product.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #D4849A', backgroundColor: 'white', color: '#A3526A', cursor: 'pointer', fontSize: '12px' }}>Excluir</button>
                    </div>
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
