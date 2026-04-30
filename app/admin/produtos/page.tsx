'use client'

import { useState, useEffect, useRef } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'

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
}

interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
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
  })
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
      setProducts(data)
    } catch (e) {
      console.error('Error loading products:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/categorias')
      const data = await res.json()
      setCategories(data.filter((c: Category) => c.isActive))
    } catch (e) {
      console.error('Error loading categories:', e)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
        setFormData({ ...formData, imageUrl: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.price || !formData.category) {
      alert('Preencha: Nome, Preço e Categoria')
      return
    }

    const slug = formData.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
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
      stock: parseInt(formData.stock) || 0,
      underOrder: formData.underOrder,
      sku: formData.sku,
    }

    try {
      if (editingId) {
        await fetch('/api/produtos', {
          method: 'PUT',
          body: JSON.stringify({ id: editingId, ...productData }),
        })
      } else {
        await fetch('/api/produtos', {
          method: 'POST',
          body: JSON.stringify(productData),
        })
      }
      setShowForm(false)
      setEditingId(null)
      setImagePreview('')
      setFormData({ name: '', price: '', category: '', description: '', imageUrl: '', stock: '0', underOrder: false, sku: '', isPersonalizable: false, isFeatured: false })
      loadProducts()
    } catch (e) {
      console.error('Error saving product:', e)
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
    })
    setImagePreview(product.imageUrl || '')
    setEditingId(product.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este produto?')) {
      try {
        await fetch(`/api/produtos?id=${id}`, { method: 'DELETE' })
        loadProducts()
      } catch (e) {
        console.error('Error deleting product:', e)
      }
    }
  }

  const handleToggleStatus = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (product) {
      try {
        await fetch('/api/produtos', {
          method: 'PUT',
          body: JSON.stringify({ id, isActive: !product.isActive, status: product.isActive ? 'draft' : 'published' }),
        })
        loadProducts()
      } catch (e) {
        console.error('Error toggling status:', e)
      }
    }
  }

  const handleToggleFeatured = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (product) {
      try {
        await fetch('/api/produtos', {
          method: 'PUT',
          body: JSON.stringify({ id, isFeatured: !product.isFeatured }),
        })
        loadProducts()
      } catch (e) {
        console.error('Error toggling featured:', e)
      }
    }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Carregando...</div>
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Produtos</h1>
          <p style={{ color: '#78716C' }}>Gerencie seus produtos</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setImagePreview(''); setFormData({ name: '', price: '', category: '', description: '', imageUrl: '', stock: '0', underOrder: false, sku: '', isPersonalizable: false, isFeatured: false }) }}>
          {showForm ? 'Cancelar' : '+ Novo Produto'}
        </Button>
      </header>

      <div style={{ marginBottom: '24px' }}>
        <Input placeholder="Buscar produtos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>{editingId ? 'Editar produto' : 'Novo Produto'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <Input label="Nome do produto" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Ex: Porta-Retratos" />
              <Input label="Preço" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required placeholder="89.90" />
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Categoria</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required style={{ width: '100%', padding: '12px 16px', borderRadius: '4px', border: '1px solid #E8E2DA', fontSize: '16px' }}>
                  <option value="">Selecione...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                  {!categories.length && (
                    <>
                      <option value="decoracao">Decoração</option>
                      <option value="cozinha">Cozinha</option>
                      <option value="escritorio">Escritório</option>
                      <option value="infantil">Infantil</option>
                      <option value="pets">Pets</option>
                      <option value="casamento">Casamento</option>
                      <option value="aniversario">Aniversário</option>
                    </>
                  )}
                </select>
              </div>
              <Input label="Estoque" type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
              <Input label="SKU" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="Código SKU (opcional)" />
            </div>
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Imagem do produto</label>
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 16px', backgroundColor: '#F5F2EE', border: '1px solid #E8E2DA', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    {imagePreview ? 'Trocar imagem' : 'Selecionar imagem'}
                  </button>
                  {imagePreview && (
                    <button type="button" onClick={() => { setImagePreview(''); setFormData({ ...formData, imageUrl: '' }) }} style={{ padding: '10px 16px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#EF4444' }}>
                      Remover
                    </button>
                  )}
                </div>
                {imagePreview && (
                  <div style={{ marginTop: '12px' }}>
                    <img src={imagePreview} alt="Preview" style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
              <Input label="Ou URL da imagem" value={formData.imageUrl} onChange={(e) => { setFormData({ ...formData, imageUrl: e.target.value }); setImagePreview(e.target.value) }} placeholder="https://..." />
            </div>
            <div style={{ marginTop: '16px' }}>
              <Input label="Descrição" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição do produto" />
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.isPersonalizable} onChange={(e) => setFormData({ ...formData, isPersonalizable: e.target.checked })} />
                <span>Personalizável</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} />
                <span>Destaque</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.underOrder} onChange={(e) => setFormData({ ...formData, underOrder: e.target.checked })} />
                <span>Sob encomenda (não requer estoque)</span>
              </label>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <Button type="submit">{editingId ? 'Salvar' : 'Criar Produto'}</Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setImagePreview('') }}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {products.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ color: '#78716C', marginBottom: '16px' }}>Nenhum produto cadastrado</p>
          <Button onClick={() => setShowForm(true)}>+ Cadastrar Primeiro Produto</Button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F5F2EE', borderBottom: '1px solid #E8E2DA' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Produto</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Categoria</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Preço</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Estoque</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Destaque</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <td style={{ padding: '16px', fontWeight: 500 }}>{product.name}</td>
                  <td style={{ padding: '16px', color: '#78716C', textTransform: 'capitalize' }}>{product.category}</td>
                  <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>R$ {product.price.toFixed(2).replace('.', ',')}</td>
                  <td style={{ padding: '16px' }}>
                    {product.underOrder ? (
                      <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: '#8B5CF620', color: '#8B5CF6' }}>
                        Sob encomenda
                      </span>
                    ) : (
                      <span style={{ color: product.stock > 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                        {product.stock} un
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button onClick={() => handleToggleStatus(product.id)} style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: product.isActive ? '#10B98120' : '#EF444420', color: product.isActive ? '#10B981' : '#EF4444', border: 'none', cursor: 'pointer' }}>
                      {product.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button onClick={() => handleToggleFeatured(product.id)} style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: product.isFeatured ? '#C8552A20' : '#E8E2DA', color: product.isFeatured ? '#C8552A' : '#78716C', border: 'none', cursor: 'pointer' }}>
                      {product.isFeatured ? 'Sim' : 'Não'}
                    </button>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(product)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #E8E2DA', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px' }}>Editar</button>
                      <button onClick={() => handleDelete(product.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #EF4444', backgroundColor: 'white', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}>Excluir</button>
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