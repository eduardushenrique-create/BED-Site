'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart, CartItem } from '@/context/CartContext'
import Button from '@/components/Button'
import Input from '@/components/Input'

interface FormData {
  customerName: string
  customerEmail: string
  customerPhone: string
  customerCpf: string
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

interface FormErrors {
  [key: string]: string
}

const shippingOptions = [
  { id: 'pac', name: 'PAC', price: 15.90, days: '5-7 dias úteis' },
  { id: 'sedex', name: 'SEDEX', price: 25.90, days: '2-3 dias úteis' },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [selectedShipping, setSelectedShipping] = useState(shippingOptions[0].id)
  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerCpf: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (items.length === 0) {
      router.push('/produtos')
    }
  }, [items, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!formData.customerName.trim()) newErrors.customerName = 'Nome é obrigatório'
    if (!formData.customerEmail.trim()) newErrors.customerEmail = 'E-mail é obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'E-mail inválido'
    }
    if (!formData.customerPhone.trim()) newErrors.customerPhone = 'Telefone é obrigatório'
    else if (!/^\(\d{2}\)\s?\d{5}-\d{4}$/.test(formData.customerPhone) && !/^\d{10,11}$/.test(formData.customerPhone.replace(/\D/g, ''))) {
      newErrors.customerPhone = 'Telefone inválido'
    }
    if (!formData.customerCpf.trim()) newErrors.customerCpf = 'CPF é obrigatório'
    else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(formData.customerCpf) && !/^\d{11}$/.test(formData.customerCpf.replace(/\D/g, ''))) {
      newErrors.customerCpf = 'CPF inválido'
    }
    if (!formData.zipCode.trim()) newErrors.zipCode = 'CEP é obrigatório'
    else if (!/^\d{5}-?\d{3}$/.test(formData.zipCode) && !/^\d{8}$/.test(formData.zipCode.replace(/\D/g, ''))) {
      newErrors.zipCode = 'CEP inválido'
    }
    if (!formData.street.trim()) newErrors.street = 'Endereço é obrigatório'
    if (!formData.number.trim()) newErrors.number = 'Número é obrigatório'
    if (!formData.neighborhood.trim()) newErrors.neighborhood = 'Bairro é obrigatório'
    if (!formData.city.trim()) newErrors.city = 'Cidade é obrigatória'
    if (!formData.state.trim()) newErrors.state = 'Estado é obrigatório'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)

    const selectedShippingOption = shippingOptions.find(s => s.id === selectedShipping)
    const shippingTotal = selectedShippingOption?.price || 0
    const total = subtotal + shippingTotal

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            variantId: item.variantId,
            variantName: item.variantName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            personalization: item.personalization,
          })),
          subtotal,
          shippingTotal,
          total,
          shippingMethod: selectedShipping,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        clearCart()
        router.push(`/pedido-confirmado?pedido=${data.orderNumber}`)
      } else {
        alert('Erro ao processar pedido. Tente novamente.')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Erro ao processar pedido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const selectedShippingOption = shippingOptions.find(s => s.id === selectedShipping)
  const shippingTotal = selectedShippingOption?.price || 0
  const total = subtotal + shippingTotal

  if (items.length === 0) {
    return null
  }

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px' }}>
        Checkout
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '32px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px' }}>
            <section>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>
                Seus dados
              </h2>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                <Input
                  label="Nome completo"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  error={errors.customerName}
                  required
                />
                <Input
                  label="E-mail"
                  name="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={handleInputChange}
                  error={errors.customerEmail}
                  required
                />
                <Input
                  label="Telefone"
                  name="customerPhone"
                  type="tel"
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  error={errors.customerPhone}
                  placeholder="(11) 99999-9999"
                  required
                />
                <Input
                  label="CPF"
                  name="customerCpf"
                  value={formData.customerCpf}
                  onChange={handleInputChange}
                  error={errors.customerCpf}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>
                Endereço de entrega
              </h2>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                <Input
                  label="CEP"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  error={errors.zipCode}
                  placeholder="00000-000"
                  required
                />
                <Input
                  label="Rua/Avenida"
                  name="street"
                  value={formData.street}
                  onChange={handleInputChange}
                  error={errors.street}
                  required
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Input
                    label="Número"
                    name="number"
                    value={formData.number}
                    onChange={handleInputChange}
                    error={errors.number}
                    required
                  />
                  <Input
                    label="Complemento"
                    name="complement"
                    value={formData.complement}
                    onChange={handleInputChange}
                  />
                </div>
                <Input
                  label="Bairro"
                  name="neighborhood"
                  value={formData.neighborhood}
                  onChange={handleInputChange}
                  error={errors.neighborhood}
                  required
                />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <Input
                    label="Cidade"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    error={errors.city}
                    required
                  />
                  <Input
                    label="Estado"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    error={errors.state}
                    placeholder="SP"
                    required
                  />
                </div>
              </div>
            </section>
          </div>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>
              Frete
            </h2>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {shippingOptions.map(option => (
                <label
                  key={option.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    borderRadius: '8px',
                    border: selectedShipping === option.id ? '2px solid #C8552A' : '1px solid #E8E2DA',
                    backgroundColor: selectedShipping === option.id ? '#FFF5F2' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value={option.id}
                    checked={selectedShipping === option.id}
                    onChange={() => setSelectedShipping(option.id)}
                    style={{ accentColor: '#C8552A' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{option.name}</div>
                    <div style={{ fontSize: '14px', color: '#78716C' }}>{option.days}</div>
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    R$ {option.price.toFixed(2).replace('.', ',')}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>
              Resumo do pedido
            </h2>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)',
            }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
                {items.map((item, idx) => (
                  <li key={`${item.productId}-${item.variantId}-${idx}`} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid #E8E2DA',
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.productName}</div>
                      {item.variantName && (
                        <div style={{ fontSize: '14px', color: '#78716C' }}>{item.variantName}</div>
                      )}
                      <div style={{ fontSize: '14px', color: '#78716C' }}>
                        {item.quantity}x
                        {item.personalization && Object.keys(item.personalization).length > 0 && (
                          <span> • {Object.values(item.personalization).join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}
                    </div>
                  </li>
                ))}
              </ul>

              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Frete</span>
                  <span>R$ {shippingTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '18px',
                  fontWeight: 600,
                  paddingTop: '12px',
                  borderTop: '1px solid #E8E2DA',
                }}>
                  <span>Total</span>
                  <span>R$ {total.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                  Pagamento
                </h3>
                <p style={{ color: '#78716C', marginBottom: '16px' }}>
                  Para este demo, o pedido será criado sem integração real de pagamento.
                  Em produção, você seria redirecionado para o gateway de pagamento.
                </p>
              </div>

              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Processando...' : `Finalizar pedido - R$ ${total.toFixed(2).replace('.', ',')}`}
              </Button>
            </div>
          </section>
        </div>
      </form>
    </main>
  )
}