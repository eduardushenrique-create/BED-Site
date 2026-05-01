'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Input from '@/components/Input'
import Button from '@/components/Button'

type User = {
  id: string
  name: string
  email: string
  phone?: string
  isVerified: boolean
  createdAt: string
}

export default function AdminClientesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      try {
        const res = await fetch('/api/clientes')
        const data = await res.json()
        if (!cancelled) setUsers(data)
      } catch (e) {
        console.error('Error loading users:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUsers()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users
    const lower = searchQuery.toLowerCase()
    return users.filter(user => 
      user.name.toLowerCase().includes(lower) ||
      user.email.toLowerCase().includes(lower) ||
      (user.phone && user.phone.includes(lower))
    )
  }, [users, searchQuery])

  async function handleCreateClient() {
    if (!newClientForm.name.trim() || !newClientForm.email.trim()) {
      setFormError('Preencha nome e e-mail para criar o cliente.')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        body: JSON.stringify({
          name: newClientForm.name.trim(),
          email: newClientForm.email.trim(),
          phone: newClientForm.phone.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Nao foi possivel criar o cliente.')
        return
      }

      setUsers(current => [data, ...current])
      setNewClientForm({ name: '', email: '', phone: '' })
      setShowCreateModal(false)
    } catch (error) {
      console.error('Error creating user:', error)
      setFormError('Erro ao criar cliente. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Carregando...</div>
  }

  return (
    <div>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Clientes</h1>
          <p style={{ color: '#6B7494' }}>Gerencie os clientes da loja</p>
        </div>
        <Button variant="blue" onClick={() => { setFormError(''); setShowCreateModal(true) }}>
          + Novo Cliente
        </Button>
      </header>

      <div style={{ marginBottom: '24px' }}>
        <Input 
          placeholder="Buscar por nome, e-mail ou telefone..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
        />
      </div>

      {users.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>Nenhum cliente encontrado</p>
          <Button variant="blue" onClick={() => { setFormError(''); setShowCreateModal(true) }}>+ Criar primeiro cliente</Button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Nome</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>E-mail</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Telefone</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Cadastro</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid #D8DCE8' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 500 }}>{user.name}</div>
                  </td>
                  <td style={{ padding: '16px', color: '#6B7494' }}>{user.email}</td>
                  <td style={{ padding: '16px', color: '#6B7494' }}>{user.phone || '-'}</td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#6B7494' }}>
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <Link 
                      href={`/admin/clientes/${user.id}`} 
                      style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #D8DCE8', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', textDecoration: 'none', color: 'inherit' }}
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '24px', color: '#6B7494', fontSize: '14px' }}>
        Total de clientes: {filteredUsers.length}
      </div>

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Novo Cliente</h2>
            <p style={{ color: '#6B7494', marginBottom: '24px' }}>Cadastre um cliente para pedidos manuais e acompanhamento no admin.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input
                label="Nome"
                value={newClientForm.name}
                onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                placeholder="Ex: Maria Silva"
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                placeholder="cliente@email.com"
                required
              />
              <Input
                label="Telefone"
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            {formError && (
              <p style={{ color: '#D4849A', fontSize: '14px', marginTop: '16px' }}>{formError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false)
                  setFormError('')
                }}
              >
                Cancelar
              </Button>
              <Button variant="blue" onClick={handleCreateClient} disabled={saving}>
                {saving ? 'Criando...' : 'Criar Cliente'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

