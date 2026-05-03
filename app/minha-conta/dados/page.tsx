'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { formatCPF, formatPhone, validateCPF } from '@/lib/validation'

export default function MeusDadosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', cpf: '' })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?redirect=/minha-conta/dados')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setForm({
            name: data.name || '',
            phone: data.phone ? formatPhone(data.phone) : '',
            cpf: data.cpf ? formatCPF(data.cpf) : '',
          })
        }
        setLoading(false)
      })
  }, [user])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSuccess('')
    setError('')

    // CPF é opcional, mas se preenchido precisa ser válido (módulo 11).
    const cpfDigits = form.cpf.replace(/\D/g, '')
    if (cpfDigits && !validateCPF(cpfDigits)) {
      setError('CPF inválido. Verifique os números informados.')
      return
    }

    setSaving(true)

    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone.replace(/\D/g, '') || null,
        cpf: cpfDigits || null,
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Erro ao salvar.')
      return
    }
    setSuccess('Dados atualizados com sucesso.')
  }

  if (authLoading || !user || loading) {
    return <main className="container" style={{ paddingTop: '112px', textAlign: 'center', color: '#6B7494' }}>Carregando...</main>
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '600px' }}>
      <Link href="/minha-conta" style={{ color: '#1D2235', fontWeight: 600, fontSize: '14px' }}>← Voltar para minha conta</Link>
      <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: '#1D2235', margin: '16px 0 8px' }}>Dados pessoais</h1>
      <p style={{ color: '#6B7494', marginBottom: '24px' }}>O e-mail não pode ser alterado por aqui — fale com o suporte se precisar trocar.</p>

      <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '16px' }}>
        <Input label="E-mail" value={user.email} disabled />
        <Input label="Nome completo" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required />
        <Input
          label="Telefone"
          value={form.phone}
          onChange={e => setForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
          placeholder="(11) 99999-9999"
        />
        <Input
          label="CPF"
          value={form.cpf}
          onChange={e => setForm(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))}
          placeholder="000.000.000-00"
        />

        {error && <p role="alert" style={{ color: '#A3526A', margin: 0 }}>{error}</p>}
        {success && <p role="status" style={{ color: '#1D7A72', margin: 0 }}>{success}</p>}

        <Button type="submit" disabled={saving} fullWidth>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
      </form>
    </main>
  )
}
