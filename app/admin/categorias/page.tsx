'use client'

import { useState, useEffect } from 'react'
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
      setCategories(data)
    } catch (e) {
      console.error('Error loading categories:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return

    const slug = formData.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
    const categoryData = { name: formData.name, slug, isActive: true, description: formData.description }

    try {
      if (editingId) {
        await fetch('/api/categorias', {
          method: 'PUT',
          body: JSON.stringify({ id: editingId, ...categoryData }),
        })
      } else {
        await fetch('/api/categorias', {
          method: 'POST',
          body: JSON.stringify(categoryData),
        })
      }
      setShowForm(false)
      setEditingId(null)
      setFormData({ name: '', description: '' })
      loadCategories()
    } catch (e) {
      console.error('Error saving category:', e)
    }
  }

  const handleEdit = (category: Category) => {
    setFormData({ name: category.name, description: category.description || '' })
    setEditingId(category.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Excluir esta categoria?')) {
      try {
        await fetch(`/api/categorias?id=${id}`, { method: 'DELETE' })
        loadCategories()
      } catch (e) {
        console.error('Error deleting category:', e)
      }
    }
  }

  const handleToggle = async (id: string) => {
    const category = categories.find(c => c.id === id)
    if (category) {
      try {
        await fetch('/api/categorias', {
          method: 'PUT',
          body: JSON.stringify({ id, isActive: !category.isActive }),
        })
        loadCategories()
      } catch (e) {
        console.error('Error toggling category:', e)
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
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Categorias</h1>
          <p style={{ color: '#78716C' }}>Gerencie as categorias de produtos</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', description: '' }) }}>
          {showForm ? 'Cancelar' : '+ Nova categoria'}
        </Button>
      </header>

      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>{editingId ? 'Editar categoria' : 'Nova categoria'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <Input label="Nome da categoria" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Decoração" required />
              <Input label="Descrição" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição opcional" />
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <Button type="submit">{editingId ? 'Salvar' : 'Criar categoria'}</Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {categories.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ color: '#78716C', marginBottom: '16px' }}>Nenhuma categoria cadastrada</p>
          <Button onClick={() => setShowForm(true)}>+ Cadastrar Primeira Categoria</Button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F5F2EE', borderBottom: '1px solid #E8E2DA' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Nome</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Descrição</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Slug</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <tr key={category.id} style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <td style={{ padding: '16px', fontWeight: 500 }}>{category.name}</td>
                  <td style={{ padding: '16px', color: '#78716C', fontSize: '14px' }}>{category.description || '-'}</td>
                  <td style={{ padding: '16px', color: '#78716C', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{category.slug}</td>
                  <td style={{ padding: '16px' }}>
                    <button onClick={() => handleToggle(category.id)} style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: category.isActive ? '#10B98120' : '#EF444420', color: category.isActive ? '#10B981' : '#EF4444', border: 'none', cursor: 'pointer' }}>
                      {category.isActive ? 'Ativa' : 'Inativa'}
                    </button>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(category)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #E8E2DA', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px' }}>Editar</button>
                      <button onClick={() => handleDelete(category.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #EF4444', backgroundColor: 'white', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}>Excluir</button>
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