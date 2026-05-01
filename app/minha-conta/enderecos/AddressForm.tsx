'use client'

import { useEffect, useState } from 'react'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { formatCEP, validateCEP } from '@/lib/validation'

export type AddressFormValues = {
  label: string
  recipient: string
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  isDefault: boolean
}

const empty: AddressFormValues = {
  label: '',
  recipient: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  isDefault: false,
}

export default function AddressForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: Partial<AddressFormValues>
  onSubmit: (values: AddressFormValues) => Promise<void> | void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<AddressFormValues>({ ...empty, ...initial })
  const [cepLoading, setCepLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const digits = form.zipCode.replace(/\D/g, '')
    if (digits.length !== 8) return
    const controller = new AbortController()
    setCepLoading(true)
    fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            street: prev.street || data.logradouro || '',
            neighborhood: prev.neighborhood || data.bairro || '',
            city: prev.city || data.localidade || '',
            state: prev.state || data.uf || '',
          }))
        }
      })
      .catch(() => {})
      .finally(() => setCepLoading(false))
    return () => controller.abort()
  }, [form.zipCode])

  function handleChange<K extends keyof AddressFormValues>(field: K, value: AddressFormValues[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!form.recipient.trim()) return setError('Informe o destinatário.')
    if (!validateCEP(form.zipCode)) return setError('CEP inválido.')
    if (!form.street.trim() || !form.number.trim() || !form.neighborhood.trim() || !form.city.trim() || !form.state.trim()) {
      return setError('Preencha rua, número, bairro, cidade e estado.')
    }
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Input label="Apelido (opcional)" value={form.label} onChange={e => handleChange('label', e.target.value)} placeholder="Casa, Trabalho..." />
        <Input label="Destinatário *" value={form.recipient} onChange={e => handleChange('recipient', e.target.value)} required />
      </div>
      <Input
        label={cepLoading ? 'CEP * (consultando...)' : 'CEP *'}
        value={form.zipCode}
        onChange={e => handleChange('zipCode', formatCEP(e.target.value))}
        placeholder="00000-000"
        required
      />
      <Input label="Rua *" value={form.street} onChange={e => handleChange('street', e.target.value)} required />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(200px, 2fr)', gap: '16px' }}>
        <Input label="Número *" value={form.number} onChange={e => handleChange('number', e.target.value)} required />
        <Input label="Complemento" value={form.complement} onChange={e => handleChange('complement', e.target.value)} />
      </div>
      <Input label="Bairro *" value={form.neighborhood} onChange={e => handleChange('neighborhood', e.target.value)} required />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(80px, 1fr)', gap: '16px' }}>
        <Input label="Cidade *" value={form.city} onChange={e => handleChange('city', e.target.value)} required />
        <Input label="UF *" value={form.state} onChange={e => handleChange('state', e.target.value.toUpperCase().slice(0, 2))} required />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#F0F5FB', borderRadius: '8px', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.isDefault} onChange={e => handleChange('isDefault', e.target.checked)} style={{ width: '18px', height: '18px' }} />
        <span style={{ fontSize: '14px' }}>Definir como endereço padrão</span>
      </label>

      {error && <p role="alert" style={{ color: '#A3526A', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '12px' }}>
        <Button type="submit" disabled={saving} style={{ flex: 1 }}>{saving ? 'Salvando...' : 'Salvar endereço'}</Button>
        <Button type="button" variant="outline" onClick={onCancel} style={{ flex: 1 }}>Cancelar</Button>
      </div>
    </form>
  )
}
