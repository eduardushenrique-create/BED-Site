'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/Button'
import AddressForm, { type AddressFormValues } from './AddressForm'

type Address = {
  id: string
  label?: string
  recipient: string
  zipCode: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  isDefault: boolean
}

export default function EnderecosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) router.replace('/login?redirect=/minha-conta/enderecos')
  }, [user, authLoading, router])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/me/addresses', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setAddresses(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  async function handleCreate(values: AddressFormValues) {
    setSaving(true)
    setError('')
    const res = await fetch('/api/me/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar endereço.')
      return
    }
    setShowNew(false)
    await load()
  }

  async function handleUpdate(id: string, values: AddressFormValues) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/me/addresses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao atualizar endereço.')
      return
    }
    setEditingId(null)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este endereço?')) return
    const res = await fetch(`/api/me/addresses/${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/me/addresses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    await load()
  }

  if (authLoading || !user || loading) {
    return <main className="container" style={{ paddingTop: '112px', textAlign: 'center', color: '#6B7494' }}>Carregando...</main>
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '760px' }}>
      <Link href="/minha-conta" style={{ color: '#1D2235', fontWeight: 600, fontSize: '14px' }}>← Voltar para minha conta</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', margin: '16px 0 24px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: '#1D2235', margin: 0 }}>Endereços salvos</h1>
          <p style={{ color: '#6B7494', margin: '4px 0 0' }}>Limite de 5 endereços por conta.</p>
        </div>
        {!showNew && addresses.length < 5 && (
          <Button onClick={() => { setShowNew(true); setEditingId(null) }} variant="blue">+ Novo endereço</Button>
        )}
      </div>

      {error && <p role="alert" style={{ color: '#A3526A', marginBottom: '16px' }}>{error}</p>}

      {showNew && (
        <div style={{ marginBottom: '24px' }}>
          <AddressForm onSubmit={handleCreate} onCancel={() => setShowNew(false)} saving={saving} />
        </div>
      )}

      {addresses.length === 0 && !showNew && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>Você ainda não cadastrou endereços.</p>
          {!showNew && <Button onClick={() => setShowNew(true)} variant="blue">Cadastrar primeiro endereço</Button>}
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '16px' }}>
        {addresses.map(addr => (
          <li key={addr.id}>
            {editingId === addr.id ? (
              <AddressForm
                initial={{
                  label: addr.label || '',
                  recipient: addr.recipient,
                  zipCode: addr.zipCode,
                  street: addr.street,
                  number: addr.number,
                  complement: addr.complement || '',
                  neighborhood: addr.neighborhood,
                  city: addr.city,
                  state: addr.state,
                  isDefault: addr.isDefault,
                }}
                onSubmit={(values) => handleUpdate(addr.id, values)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: '#1D2235' }}>{addr.label || addr.recipient}</strong>
                    {addr.isDefault && (
                      <span style={{ marginLeft: '10px', padding: '2px 8px', background: '#DFF4EC', color: '#1D7A72', fontSize: '12px', fontWeight: 700, borderRadius: '999px' }}>Padrão</span>
                    )}
                    <div style={{ fontSize: '13px', color: '#6B7494' }}>{addr.recipient}</div>
                  </div>
                </div>
                <p style={{ margin: 0, color: '#1D2235', fontSize: '14px', lineHeight: 1.6 }}>
                  {addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ''}<br />
                  {addr.neighborhood} · {addr.city}-{addr.state} · CEP {addr.zipCode}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <button onClick={() => { setEditingId(addr.id); setShowNew(false) }} style={btnGhost}>Editar</button>
                  {!addr.isDefault && <button onClick={() => handleSetDefault(addr.id)} style={btnGhost}>Definir como padrão</button>}
                  <button onClick={() => handleDelete(addr.id)} style={{ ...btnGhost, color: '#A3526A', borderColor: '#F1E5E9' }}>Excluir</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}

const btnGhost: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  background: 'white',
  color: '#1D2235',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
}
