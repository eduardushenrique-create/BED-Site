'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { formatCEP, formatCPF, formatPhone, validateCEP, validateCPF, validateEmail } from '@/lib/validation'

type FormData = {
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

type ShippingOption = {
  id: string
  name: string
  price: number
  deliveryTime: { days: number; min?: number; max?: number }
  company: { name: string; picture: string }
}

type FormErrors = Record<string, string>

const initialForm: FormData = {
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
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()
  const [formData, setFormData] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShipping, setSelectedShipping] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [cepLoading, setCepLoading] = useState(false)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (items.length === 0) router.push('/produtos')
  }, [items.length, router])

  useEffect(() => {
    const zip = formData.zipCode.replace(/\D/g, '')
    if (zip.length !== 8) {
      return
    }

    const controller = new AbortController()
    async function fetchAddress() {
      setCepLoading(true)
      try {
        const timer = window.setTimeout(() => controller.abort(), 7000)
        const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`, { signal: controller.signal })
        window.clearTimeout(timer)
        const data = await response.json()

        if (!response.ok || data.erro) {
          setErrors(prev => ({ ...prev, zipCode: 'CEP nao encontrado.' }))
          return
        }

        setFormData(prev => ({
          ...prev,
          street: prev.street || data.logradouro || '',
          neighborhood: prev.neighborhood || data.bairro || '',
          city: prev.city || data.localidade || '',
          state: prev.state || data.uf || '',
        }))
      } catch {
        setErrors(prev => ({ ...prev, zipCode: 'Erro ao consultar CEP. Tente novamente.' }))
      } finally {
        setCepLoading(false)
      }
    }

    fetchAddress()
    return () => controller.abort()
  }, [formData.zipCode])

  useEffect(() => {
    const zip = formData.zipCode.replace(/\D/g, '')
    if (zip.length !== 8 || items.length === 0) return

    async function calculateShipping() {
      setShippingLoading(true)
      setErrors(prev => ({ ...prev, shipping: '' }))
      try {
        const response = await fetch('/api/shipping/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromPostalCode: process.env.NEXT_PUBLIC_STORE_ORIGIN_ZIP || '01001000',
            toPostalCode: zip,
            items: items.map(item => ({ productId: item.productId, quantity: item.quantity })),
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          setShippingOptions([])
          setSelectedShipping('')
          setErrors(prev => ({ ...prev, shipping: data.error || 'Erro ao calcular frete.' }))
          return
        }
        setShippingOptions(data)
        setSelectedShipping(data[0]?.id || '')
      } catch {
        setShippingOptions([])
        setSelectedShipping('')
        setErrors(prev => ({ ...prev, shipping: 'Erro ao calcular frete.' }))
      } finally {
        setShippingLoading(false)
      }
    }

    calculateShipping()
  }, [formData.zipCode, items])

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    const nextValue =
      name === 'zipCode' ? formatCEP(value) :
      name === 'customerCpf' ? formatCPF(value) :
      name === 'customerPhone' ? formatPhone(value) :
      name === 'state' ? value.toUpperCase().slice(0, 2) :
      value

    setFormData(prev => ({ ...prev, [name]: nextValue }))
    if (name === 'zipCode' && nextValue.replace(/\D/g, '').length !== 8) {
      setShippingOptions([])
      setSelectedShipping('')
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  function validateForm() {
    const nextErrors: FormErrors = {}
    if (!formData.customerName.trim()) nextErrors.customerName = 'Nome completo e obrigatorio.'
    if (!validateEmail(formData.customerEmail)) nextErrors.customerEmail = 'Informe um e-mail valido.'
    if (!formData.customerPhone.replace(/\D/g, '').match(/^\d{10,11}$/)) nextErrors.customerPhone = 'Informe um telefone valido.'
    if (!validateCPF(formData.customerCpf)) nextErrors.customerCpf = 'Informe um CPF valido.'
    if (!validateCEP(formData.zipCode)) nextErrors.zipCode = 'Informe um CEP valido.'
    if (!formData.street.trim()) nextErrors.street = 'Rua e obrigatoria.'
    if (!formData.number.trim()) nextErrors.number = 'Numero e obrigatorio.'
    if (!formData.neighborhood.trim()) nextErrors.neighborhood = 'Bairro e obrigatorio.'
    if (!formData.city.trim()) nextErrors.city = 'Cidade e obrigatoria.'
    if (!formData.state.trim()) nextErrors.state = 'Estado e obrigatorio.'
    if (!selectedShipping) nextErrors.shipping = 'Selecione uma opcao de frete.'
    if (!paymentMethod) nextErrors.paymentMethod = 'Selecione uma forma de pagamento.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validateForm()) return

    setLoading(true)
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
          shippingMethod: selectedShipping,
          paymentMethod,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setErrors(prev => ({ ...prev, submit: data.error || 'Erro ao processar pedido.' }))
        return
      }

      clearCart()
      if (data.payment?.checkoutUrl) {
        window.location.href = data.payment.checkoutUrl
        return
      }
      router.push(`/pedido-confirmado?pedido=${data.orderNumber}`)
    } catch {
      setErrors(prev => ({ ...prev, submit: 'Erro ao processar pedido. Tente novamente.' }))
    } finally {
      setLoading(false)
    }
  }

  const selectedShippingOption = shippingOptions.find(option => option.id === selectedShipping)
  const shippingTotal = selectedShippingOption?.price || 0
  const total = subtotal + shippingTotal

  if (items.length === 0) return null

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', color: '#1D2235' }}>Checkout</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '32px' }}>
            <section>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Seus dados</h2>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Input label="Nome completo" name="customerName" value={formData.customerName} onChange={handleInputChange} error={errors.customerName} required aria-required="true" />
                <Input label="E-mail" name="customerEmail" type="email" value={formData.customerEmail} onChange={handleInputChange} error={errors.customerEmail} required aria-required="true" />
                <Input label="Telefone" name="customerPhone" type="tel" value={formData.customerPhone} onChange={handleInputChange} error={errors.customerPhone} placeholder="(11) 99999-9999" required aria-required="true" />
                <Input label="CPF" name="customerCpf" value={formData.customerCpf} onChange={handleInputChange} error={errors.customerCpf} placeholder="000.000.000-00" required aria-required="true" />
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Endereco de entrega</h2>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Input label={cepLoading ? 'CEP (consultando...)' : 'CEP'} name="zipCode" value={formData.zipCode} onChange={handleInputChange} error={errors.zipCode} placeholder="00000-000" required aria-required="true" />
                <Input label="Rua/Avenida" name="street" value={formData.street} onChange={handleInputChange} error={errors.street} required aria-required="true" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                  <Input label="Numero" name="number" value={formData.number} onChange={handleInputChange} error={errors.number} required aria-required="true" />
                  <Input label="Complemento" name="complement" value={formData.complement} onChange={handleInputChange} />
                </div>
                <Input label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleInputChange} error={errors.neighborhood} required aria-required="true" />
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(90px, 1fr)', gap: '16px' }}>
                  <Input label="Cidade" name="city" value={formData.city} onChange={handleInputChange} error={errors.city} required aria-required="true" />
                  <Input label="Estado" name="state" value={formData.state} onChange={handleInputChange} error={errors.state} placeholder="SP" required aria-required="true" />
                </div>
              </div>
            </section>
          </div>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Frete</h2>
            {!validateCEP(formData.zipCode) && <p style={{ color: '#5F6678' }}>Informe seu CEP para calcular o frete.</p>}
            {shippingLoading && <p style={{ color: '#5F6678' }}>Calculando frete...</p>}
            {errors.shipping && <p role="alert" style={{ color: '#B42318' }}>{errors.shipping}</p>}
            <div style={{ display: 'grid', gap: '12px' }}>
              {shippingOptions.map(option => (
                <label key={option.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '8px',
                  border: selectedShipping === option.id ? '2px solid #D4849A' : '1px solid #BBCFEB',
                  backgroundColor: selectedShipping === option.id ? '#F0F5FB' : 'white',
                  cursor: 'pointer',
                }}>
                  <input type="radio" name="shipping" value={option.id} checked={selectedShipping === option.id} onChange={() => setSelectedShipping(option.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{option.name}</div>
                    <div style={{ fontSize: '14px', color: '#5F6678' }}>{option.company.name} - prazo estimado: {option.deliveryTime.days} dias</div>
                  </div>
                  <strong>R$ {option.price.toFixed(2).replace('.', ',')}</strong>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Pagamento</h2>
            {errors.paymentMethod && <p role="alert" style={{ color: '#B42318' }}>{errors.paymentMethod}</p>}
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                { id: 'pix', label: 'Pix' },
                { id: 'card', label: 'Cartao pelo checkout seguro' },
              ].map(method => (
                <label key={method.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '14px', border: '1px solid #BBCFEB', borderRadius: '8px', background: 'white' }}>
                  <input type="radio" name="paymentMethod" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />
                  {method.label}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Resumo do pedido</h2>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
                {items.map((item, idx) => (
                  <li key={`${item.productId}-${item.variantId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid #E3E9F4' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.productName}</div>
                      {item.variantName && <div style={{ fontSize: '14px', color: '#5F6678' }}>{item.variantName}</div>}
                      <div style={{ fontSize: '14px', color: '#5F6678' }}>{item.quantity}x</div>
                    </div>
                    <strong>R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}</strong>
                  </li>
                ))}
              </ul>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Frete</span><span>{selectedShipping ? `R$ ${shippingTotal.toFixed(2).replace('.', ',')}` : '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, paddingTop: '12px', borderTop: '1px solid #E3E9F4' }}>
                  <span>Total estimado</span><span>R$ {total.toFixed(2).replace('.', ',')}</span>
                </div>
                <p style={{ color: '#5F6678', fontSize: '13px', margin: 0 }}>Os totais sao recalculados no servidor antes da criacao do pedido.</p>
              </div>
              {errors.submit && <p role="alert" style={{ color: '#B42318' }}>{errors.submit}</p>}
              <div style={{ marginTop: '24px' }}>
                <Button type="submit" fullWidth disabled={loading || shippingLoading}>
                  {loading ? 'Processando...' : `Concluir compra - R$ ${total.toFixed(2).replace('.', ',')}`}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </form>
    </main>
  )
}
