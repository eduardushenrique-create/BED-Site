'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'

interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
  description?: string
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setLoading(true)
    try {
      const res = await fetch('/api/categorias')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formData.name) return

    const slug = formData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')

    const categoryData = {
      name: formData.name,
      slug,
      isActive: true,
      description: formData.description,
    }

    try {
      await fetch('/api/categorias', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(editingId ? { id: editingId, ...categoryData } : categoryData),
      })
      setShowForm(false)
      setEditingId(null)
      setFormData({ name: '', description: '' })
      loadCategories()
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

  const handleEdit = (category: Category) => {
    setFormData({ name: category.name, description: category.description || '' })
    setEditingId(category.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return

    try {
      await fetch(`/api/categorias?id=${id}`, { method: 'DELETE' })
      loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const handleToggle = async (id: string) => {
    const category = categories.find(item => item.id === id)
    if (!category) return

    try {
      await fetch('/api/categorias', {
        method: 'PUT',
        body: JSON.stringify({ id, isActive: !category.isActive }),
      })
      loadCategories()
    } catch (error) {
      console.error('Error toggling category:', error)
    }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235' }}>Categorias</h1>
          <p style={{ color: '#6B7494' }}>Gerencie as categorias de produtos</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', description: '' }) }}>
          {showForm ? 'Cancelar' : '+ Nova categoria'}
        </Button>
      </header>

      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: '#1D2235' }}>
            {editingId ? 'Editar categoria' : 'Nova categoria'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <Input label="Nome da categoria" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Ex: Decoracao" required />
              <Input label="Descricao" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Descricao opcional" />
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <Button type="submit">{editingId ? 'Salvar' : 'Criar categoria'}</Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {categories.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '48px', textAlign: 'center', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>Nenhuma categoria cadastrada</p>
          <Button onClick={() => setShowForm(true)}>+ Cadastrar primeira categoria</Button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Nome</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Descricao</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Slug</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <tr key={category.id} style={{ borderBottom: '1px solid #D8DCE8' }}>
                  <td style={{ padding: '16px', fontWeight: 500 }}>{category.name}</td>
                  <td style={{ padding: '16px', color: '#6B7494', fontSize: '14px' }}>{category.description || '-'}</td>
                  <td style={{ padding: '16px', color: '#6B7494', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{category.slug}</td>
                  <td style={{ padding: '16px' }}>
                    <button onClick={() => handleToggle(category.id)} style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: category.isActive ? '#DFF4EC' : '#FDE8E8', color: category.isActive ? '#1D7A72' : '#B42318', border: 'none', cursor: 'pointer' }}>
                      {category.isActive ? 'Ativa' : 'Inativa'}
                    </button>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(category)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', color: '#1D2235' }}>Editar</button>
                      <button onClick={() => handleDelete(category.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #D4849A', backgroundColor: 'white', color: '#A3526A', cursor: 'pointer', fontSize: '12px' }}>Excluir</button>
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
