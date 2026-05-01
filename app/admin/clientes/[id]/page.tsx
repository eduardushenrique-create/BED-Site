'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type User = {
  id: string
  name: string
  email: string
  phone?: string
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

type Order = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  total: number
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  createdAt: string
}

const fulfillmentStatuses = [
  { value: 'pending', label: 'Pendente', color: '#F59E0B' },
  { value: 'production', label: 'Em producao', color: '#3B82F6' },
  { value: 'shipped', label: 'Enviado', color: '#8B5CF6' },
  { value: 'delivered', label: 'Entregue', color: '#10B981' },
  { value: 'cancelled', label: 'Cancelado', color: '#EF4444' },
]

const paymentStatuses = [
  { value: 'pending', label: 'Pendente', color: '#F59E0B' },
  { value: 'paid', label: 'Pago', color: '#10B981' },
  { value: 'failed', label: 'Recusado', color: '#EF4444' },
  { value: 'refunded', label: 'Estornado', color: '#8B5CF6' },
]

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>{title}</h2>
      {children}
    </section>
  )
}

function StatusPill({ status, options }: { status: string; options: { value: string; label: string; color: string }[] }) {
  const option = options.find(item => item.value === status)
  if (!option) return <span style={{ fontSize: '12px', color: '#6B7494' }}>{status}</span>

  return (
    <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, backgroundColor: `${option.color}20`, color: option.color }}>
      {option.label}
    </span>
  )
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadCustomerDetail() {
      setLoading(true)
      try {
        const [usersRes, ordersRes] = await Promise.all([
          fetch('/api/clientes'),
          fetch('/api/pedidos'),
        ])
        const users: User[] = await usersRes.json()
        const allOrders: Order[] = await ordersRes.json()
        const found = users.find(item => item.id === id) || null

        setUser(found)
        if (found) {
          setEditForm({ name: found.name, email: found.email, phone: found.phone || '' })
          setOrders(allOrders.filter(order => order.customerEmail.toLowerCase() === found.email.toLowerCase()))
        } else {
          setOrders([])
        }
      } catch (error) {
        console.error('Error loading customer detail:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCustomerDetail()
  }, [id])

  const stats = useMemo(() => ({
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, order) => sum + (order.total || 0), 0),
    pending: orders.filter(order => order.paymentStatus === 'pending').length,
    paid: orders.filter(order => order.paymentStatus === 'paid').length,
  }), [orders])

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'PUT',
        body: JSON.stringify({
          id: user.id,
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
        }),
      })

      if (!res.ok) throw new Error('Failed to save customer')
      const updated = await res.json()
      setUser(updated)
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Erro ao salvar cliente')
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmail = () => {
    if (!user) return
    const subject = encodeURIComponent('Contato - Forma 3D')
    const body = encodeURIComponent(`Ola ${user.name}!\n\nSomos da Forma 3D.\n\nAtenciosamente,\nForma 3D`)
    window.open(`mailto:${user.email}?subject=${subject}&body=${body}`)
  }

  const handleSendWhatsApp = () => {
    if (!user?.phone) return
    const phone = user.phone.replace(/\D/g, '')
    const message = encodeURIComponent(`Ola ${user.name}! Somos da Forma 3D.`)
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Carregando...</div>
  }

  if (!user) {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>Cliente nao encontrado</h1>
        <Link href="/admin/clientes" style={{ color: '#D4849A', fontWeight: 600 }}>Voltar aos clientes</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/clientes" style={{ color: '#6B7494', textDecoration: 'none', fontWeight: 600 }}>
          Voltar aos clientes
        </Link>
      </div>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>{user.name}</h1>
          <p style={{ color: '#6B7494', marginTop: '4px' }}>
            Cliente desde {new Date(user.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => setIsEditing(true)} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Editar</button>
            <button onClick={handleSendEmail} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Enviar e-mail</button>
            {user.phone && (
              <button onClick={handleSendWhatsApp} style={{ padding: '10px 16px', backgroundColor: '#25D366', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'white' }}>WhatsApp</button>
            )}
          </div>
        )}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(0, 1.6fr)', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card title="Dados do Cliente">
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>
                  Nome
                  <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }} />
                </label>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>
                  E-mail
                  <input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }} />
                </label>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>
                  Telefone
                  <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="(11) 99999-9999" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }} />
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setIsEditing(false); setEditForm({ name: user.name, email: user.email, phone: user.phone || '' }) }} style={{ flex: 1, padding: '10px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', backgroundColor: '#1D2235', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 600 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><p style={{ fontSize: '13px', color: '#6B7494' }}>Nome</p><p style={{ fontWeight: 600 }}>{user.name}</p></div>
                <div><p style={{ fontSize: '13px', color: '#6B7494' }}>E-mail</p><p>{user.email}</p></div>
                <div><p style={{ fontSize: '13px', color: '#6B7494' }}>Telefone</p><p>{user.phone || '-'}</p></div>
                <div><p style={{ fontSize: '13px', color: '#6B7494' }}>Atualizado em</p><p>{new Date(user.updatedAt || user.createdAt).toLocaleDateString('pt-BR')}</p></div>
              </div>
            )}
          </Card>

          <Card title="Resumo">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '14px', backgroundColor: '#F0F5FB', borderRadius: '10px' }}><strong style={{ display: 'block', fontSize: '22px' }}>{stats.totalOrders}</strong><span style={{ color: '#6B7494', fontSize: '13px' }}>Pedidos</span></div>
              <div style={{ padding: '14px', backgroundColor: '#F0F5FB', borderRadius: '10px' }}><strong style={{ display: 'block', fontSize: '22px' }}>{stats.paid}</strong><span style={{ color: '#6B7494', fontSize: '13px' }}>Pagos</span></div>
              <div style={{ padding: '14px', backgroundColor: '#F0F5FB', borderRadius: '10px' }}><strong style={{ display: 'block', fontSize: '22px' }}>{stats.pending}</strong><span style={{ color: '#6B7494', fontSize: '13px' }}>Pendentes</span></div>
              <div style={{ padding: '14px', backgroundColor: '#F0F5FB', borderRadius: '10px' }}><strong style={{ display: 'block', fontSize: '18px' }}>R$ {stats.totalSpent.toFixed(2).replace('.', ',')}</strong><span style={{ color: '#6B7494', fontSize: '13px' }}>Total gasto</span></div>
            </div>
          </Card>
        </div>

        <Card title="Historico de Pedidos">
          {orders.length === 0 ? (
            <p style={{ color: '#6B7494' }}>Nenhum pedido encontrado para este e-mail.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {orders.map(order => (
                <Link key={order.id} href={`/admin/pedidos/${order.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', padding: '16px 0', borderBottom: '1px solid #D8DCE8', color: 'inherit', textDecoration: 'none' }}>
                  <div>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{order.orderNumber}</strong>
                    <p style={{ fontSize: '13px', color: '#6B7494', marginTop: '4px' }}>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <StatusPill status={order.paymentStatus} options={paymentStatuses} />
                      <StatusPill status={order.fulfillmentStatus} options={fulfillmentStatuses} />
                    </div>
                  </div>
                  <strong>R$ {order.total.toFixed(2).replace('.', ',')}</strong>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

