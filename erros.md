'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Input from '@/components/Input'
import Button from '@/components/Button'

type Order = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: {
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }
  total: number
  subtotal: number
  shippingCost: number
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  paymentMethod: string
  createdAt: string
  items: { productId: string; productName: string; quantity: number; unitPrice: number; observation?: string }[]
  trackingCode: string | null
}

type Product = {
  id: string
  name: string
  price: number
  stock: number
  underOrder: boolean
  isActive: boolean
}

const fulfillmentStatuses = [
  { value: 'pending', label: 'Pendente', color: '#F59E0B' },
  { value: 'production', label: 'Em produção', color: '#3B82F6' },
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

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px' }}>
      <span style={{ fontSize: '24px', fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: '12px', color: '#78716C', marginTop: '4px' }}>{label}</span>
    </div>
  )
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<{id: string; name: string; email: string; phone: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [fulfillmentFilter, setFulfillmentFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [searchProduct, setSearchProduct] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [newOrderItems, setNewOrderItems] = useState<{productId: string; productName: string; quantity: number; unitPrice: number; observation?: string}[]>([])
  const [searchCustomer, setSearchCustomer] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [foundCustomers, setFoundCustomers] = useState<{id: string; name: string; email: string; phone: string}[]>([])
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
  })

  useEffect(() => {
    loadOrders()
    loadProducts()
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const res = await fetch('/api/clientes')
      const data = await res.json()
      setUsers(data)
    } catch (e) {
      console.error('Error loading users:', e)
    }
  }

  async function searchUsers(query: string) {
    if (!query) {
      setFoundCustomers([])
      return
    }
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setFoundCustomers(data)
    } catch (e) {
      console.error('Error searching users:', e)
    }
  }

  const handleSelectCustomer = (customer: {id: string; name: string; email: string; phone: string}) => {
    setNewOrderForm({
      ...newOrderForm,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || '',
    })
    setSearchCustomer('')
    setFoundCustomers([])
    setShowCustomerDropdown(false)
  }

  const handleCreateNewCustomer = () => {
    setSearchCustomer('NEW')
    setFoundCustomers([])
    setShowCustomerDropdown(false)
  }

  async function loadOrders() {
    setLoading(true)
    try {
      const res = await fetch('/api/pedidos')
      const data = await res.json()
      setOrders(data)
    } catch (e) {
      console.error('Error loading orders:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadProducts() {
    try {
      const res = await fetch('/api/produtos')
      const data = await res.json()
      const available = data.filter((p: Product) => p.isActive && (p.stock > 0 || p.underOrder))
      setProducts(available)
    } catch (e) {
      console.error('Error loading products:', e)
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = !searchQuery || 
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFulfillment = !fulfillmentFilter || order.fulfillmentStatus === fulfillmentFilter
      const matchesPayment = !paymentFilter || order.paymentStatus === paymentFilter
      return matchesSearch && matchesFulfillment && matchesPayment
    })
  }, [orders, searchQuery, fulfillmentFilter, paymentFilter])

  const statusCounts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.paymentStatus === 'pending').length,
    paid: orders.filter(o => o.paymentStatus === 'paid').length,
    production: orders.filter(o => o.fulfillmentStatus === 'production').length,
    shipped: orders.filter(o => o.fulfillmentStatus === 'shipped').length,
    delivered: orders.filter(o => o.fulfillmentStatus === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders])

  const availableProducts = useMemo(() => {
    if (!searchProduct) return products
    return products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()))
  }, [products, searchProduct])

  const orderSubtotal = useMemo(() => {
    return newOrderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  }, [newOrderItems])

  const handleViaCep = async () => {
    const cep = newOrderForm.zipCode.replace(/\D/g, '')
    if (cep.length !== 8) {
      alert('CEP deve ter 8 dígitos')
      return
    }
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) {
        alert('CEP não encontrado')
        return
      }
      setNewOrderForm({
        ...newOrderForm,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      })
    } catch (e) {
      console.error('Error fetching CEP:', e)
      alert('Erro ao buscar CEP')
    } finally {
      setCepLoading(false)
    }
  }

  const handleAddProduct = (product: Product) => {
    const existing = newOrderItems.find(item => item.productId === product.id)
    if (existing) {
      setNewOrderItems(newOrderItems.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setNewOrderItems([...newOrderItems, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      }])
    }
    setSearchProduct('')
    setShowProductDropdown(false)
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setNewOrderItems(newOrderItems.filter(item => item.productId !== productId))
    } else {
      setNewOrderItems(newOrderItems.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      ))
    }
  }

  const handleUpdateObservation = (productId: string, observation: string) => {
    setNewOrderItems(newOrderItems.map(item => 
      item.productId === productId ? { ...item, observation } : item
    ))
  }

  const handleRemoveItem = (productId: string) => {
    setNewOrderItems(newOrderItems.filter(item => item.productId !== productId))
  }

  async function handleCreateOrder() {
    if (!newOrderForm.customerName || !newOrderForm.customerEmail || newOrderItems.length === 0) {
      alert('Preencha: Nome, E-mail e adicione pelo menos um produto')
      return
    }
    
    const orderData = {
      orderNumber: `BD-${Date.now().toString(36).toUpperCase()}`,
      customerName: newOrderForm.customerName,
      customerEmail: newOrderForm.customerEmail,
      customerPhone: newOrderForm.customerPhone,
      shippingAddress: {
        street: newOrderForm.street,
        number: newOrderForm.number,
        complement: newOrderForm.complement,
        neighborhood: newOrderForm.neighborhood,
        city: newOrderForm.city,
        state: newOrderForm.state,
        zipCode: newOrderForm.zipCode,
      },
      total: orderSubtotal,
      subtotal: orderSubtotal,
      shippingCost: 0,
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      paymentMethod: 'manual',
      createdAt: new Date().toISOString(),
      items: newOrderItems,
      trackingCode: null,
    }

    try {
      await fetch('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(orderData),
      })
      
      try {
        await fetch('/api/clientes', {
          method: 'POST',
          body: JSON.stringify({
            name: newOrderForm.customerName,
            email: newOrderForm.customerEmail,
            phone: newOrderForm.customerPhone,
          }),
        })
      } catch (e) {
        console.log('Cliente pode já existir')
      }
      
      setShowAddModal(false)
      setSearchCustomer('')
      setNewOrderForm({ customerName: '', customerEmail: '', customerPhone: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' })
      setNewOrderItems([])
      loadOrders()
    } catch (e) {
      console.error('Error creating order:', e)
    }
  }

  const openCreateModal = () => {
    setNewOrderItems([])
    setSearchProduct('')
    setShowAddModal(true)
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Carregando...</div>
  }

  return (
    <div>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Pedidos</h1>
          <p style={{ color: '#78716C' }}>Gerencie os pedidos da loja</p>
        </div>
        <button onClick={openCreateModal} style={{ padding: '12px 24px', backgroundColor: '#1C1917', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>+ Novo Pedido</button>
      </header>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatusCard label="Total" count={statusCounts.total} color="#1C1917" />
        <StatusCard label="Pendentes" count={statusCounts.pending} color="#F59E0B" />
        <StatusCard label="Pagos" count={statusCounts.paid} color="#10B981" />
        <StatusCard label="Produção" count={statusCounts.production} color="#3B82F6" />
        <StatusCard label="Enviados" count={statusCounts.shipped} color="#8B5CF6" />
        <StatusCard label="Entregues" count={statusCounts.delivered} color="#059669" />
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <Input placeholder="Buscar por cliente, e-mail ou pedido..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select value={fulfillmentFilter} onChange={(e) => setFulfillmentFilter(e.target.value)} style={{ padding: '12px 16px', borderRadius: '6px', border: '1px solid #E8E2DA', fontSize: '14px' }}>
          <option value="">Todos Status</option>
          {fulfillmentStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ padding: '12px 16px', borderRadius: '6px', border: '1px solid #E8E2DA', fontSize: '14px' }}>
          <option value="">Todos Pagamentos</option>
          {paymentStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {orders.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ color: '#78716C', marginBottom: '16px' }}>Nenhum pedido encontrado</p>
          <Button onClick={openCreateModal}>+ Criar Primeiro Pedido</Button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F5F2EE', borderBottom: '1px solid #E8E2DA' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Pedido</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Cliente</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Total</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Pagamento</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Data</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid #E8E2DA' }}>
                  <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{order.orderNumber}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 500 }}>{order.customerName}</div>
                    <div style={{ fontSize: '12px', color: '#78716C' }}>{order.customerEmail}</div>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600 }}>R$ {order.total.toFixed(2).replace('.', ',')}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: paymentStatuses.find(s => s.value === order.paymentStatus)?.color + '20', color: paymentStatuses.find(s => s.value === order.paymentStatus)?.color }}>
                      {paymentStatuses.find(s => s.value === order.paymentStatus)?.label || order.paymentStatus}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: fulfillmentStatuses.find(s => s.value === order.fulfillmentStatus)?.color + '20', color: fulfillmentStatuses.find(s => s.value === order.fulfillmentStatus)?.color }}>
                      {fulfillmentStatuses.find(s => s.value === order.fulfillmentStatus)?.label || order.fulfillmentStatus}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#78716C' }}>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '16px' }}>
                    <Link href={`/admin/pedidos/${order.id}`} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #E8E2DA', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', textDecoration: 'none', color: 'inherit' }}>Ver</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Novo Pedido</h2>
            
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Itens do Pedido</h3>
              <div style={{ position: 'relative' }}>
                <Input placeholder="Buscar produto..." value={searchProduct} onChange={(e) => { setSearchProduct(e.target.value); setShowProductDropdown(true) }} />
                {showProductDropdown && availableProducts.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {availableProducts.map(product => (
                      <div key={product.id} onClick={() => handleAddProduct(product)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F5F2EE', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{product.name}</span>
                        <span style={{ color: '#78716C' }}>R$ {product.price.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {newOrderItems.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {newOrderItems.map(item => (
                    <div key={item.productId} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#F5F2EE', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ flex: 1, fontWeight: 500 }}>{item.productName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button type="button" onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)} style={{ width: '32px', height: '32px', borderRadius: '4px', border: '1px solid #E8E2DA', backgroundColor: 'white', cursor: 'pointer', fontSize: '18px' }}>−</button>
                          <span style={{ minWidth: '40px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                          <button type="button" onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)} style={{ width: '32px', height: '32px', borderRadius: '4px', border: '1px solid #E8E2DA', backgroundColor: 'white', cursor: 'pointer', fontSize: '18px' }}>+</button>
                        </div>
                        <span style={{ fontWeight: 600, minWidth: '80px', textAlign: 'right' }}>R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}</span>
                        <button type="button" onClick={() => handleRemoveItem(item.productId)} style={{ width: '32px', height: '32px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '4px', cursor: 'pointer', color: '#EF4444', fontSize: '16px' }}>×</button>
                      </div>
                      <input type="text" placeholder="Observações (ex:/cor gravado, cor verde, etc)" value={item.observation || ''} onChange={(e) => handleUpdateObservation(item.productId, e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #E8E2DA', fontSize: '14px' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', fontWeight: 700, fontSize: '18px', borderTop: '2px solid #E8E2DA', marginTop: '12px' }}>
                    <span>Total:</span>
                    <span>R$ {orderSubtotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Cliente</h3>
                <div style={{ position: 'relative' }}>
                  <Input 
                    placeholder="Buscar cliente por nome, e-mail ou telefone..." 
                    value={searchCustomer} 
                    onChange={(e) => { 
                      setSearchCustomer(e.target.value)
                      searchUsers(e.target.value)
                      setShowCustomerDropdown(true)
                    }} 
                  />
                  {showCustomerDropdown && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {foundCustomers.length > 0 ? (
                      foundCustomers.map(customer => (
                        <div key={customer.id} onClick={() => handleSelectCustomer(customer)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F5F2EE' }}>
                          <div style={{ fontWeight: 500 }}>{customer.name}</div>
                          <div style={{ fontSize: '12px', color: '#78716C' }}>{customer.email}</div>
                        </div>
                      ))
                    ) : searchCustomer.length >= 2 && (
                      <div onClick={handleCreateNewCustomer} style={{ padding: '12px 16px', cursor: 'pointer', backgroundColor: '#F5F2EE', fontWeight: 500 }}>
                        + Criar novo cliente: {searchCustomer}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
              <Input label="Nome do cliente" value={newOrderForm.customerName} onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })} required />
              <Input label="E-mail" type="email" value={newOrderForm.customerEmail} onChange={(e) => setNewOrderForm({ ...newOrderForm, customerEmail: e.target.value })} required />
              <Input label="Telefone" value={newOrderForm.customerPhone} onChange={(e) => setNewOrderForm({ ...newOrderForm, customerPhone: e.target.value })} required placeholder="(11) 99999-9999" />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <Input label="CEP" value={newOrderForm.zipCode} onChange={(e) => setNewOrderForm({ ...newOrderForm, zipCode: e.target.value })} required placeholder="00000-000" style={{ flex: 1 }} />
                <button onClick={handleViaCep} disabled={cepLoading} style={{ padding: '12px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '6px', cursor: cepLoading ? 'not-allowed' : 'pointer' }}>
                  {cepLoading ? '...' : 'Buscar'}
                </button>
              </div>
              <Input label="Rua" value={newOrderForm.street} onChange={(e) => setNewOrderForm({ ...newOrderForm, street: e.target.value })} required style={{ gridColumn: '1 / -1' }} />
              <Input label="Número" value={newOrderForm.number} onChange={(e) => setNewOrderForm({ ...newOrderForm, number: e.target.value })} required />
              <Input label="Complemento" value={newOrderForm.complement} onChange={(e) => setNewOrderForm({ ...newOrderForm, complement: e.target.value })} />
              <Input label="Bairro" value={newOrderForm.neighborhood} onChange={(e) => setNewOrderForm({ ...newOrderForm, neighborhood: e.target.value })} required />
              <Input label="Cidade" value={newOrderForm.city} onChange={(e) => setNewOrderForm({ ...newOrderForm, city: e.target.value })} required />
              <Input label="Estado" value={newOrderForm.state} onChange={(e) => setNewOrderForm({ ...newOrderForm, state: e.target.value })} required placeholder="SP" />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreateOrder} style={{ padding: '10px 20px', backgroundColor: '#1C1917', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}>Criar Pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}