'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { variantEffectivePrice, describeVariant } from '@/lib/products/variant-pricing'
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  getFulfillmentInfo,
  getPaymentInfo,
  getNextStage,
  getPreviousStage,
  canAdvance,
  canRegress,
} from '@/lib/order-statuses'

type ProductVariant = {
  id: string
  name: string
  sku: string | null
  color: string | null
  size: string | null
  material: string | null
  finish: string | null
  priceDelta: number | null
  priceOverride: number | null
  stockQuantity: number
  isAvailable: boolean
}

type Product = {
  id: string
  name: string
  price: number
  stock?: number
  underOrder?: boolean
  isActive: boolean
  visibility?: 'public' | 'internal'
  variants: ProductVariant[]
}

type NewOrderItem = {
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  quantity: number
  unitPrice: number
  observation?: string
}

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
  items: NewOrderItem[]
  trackingCode: string | null
  expectedDeliveryAt?: string | null
}

function itemKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? ''}`
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px' }}>
      <span style={{ fontSize: '24px', fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: '12px', color: '#6B7494', marginTop: '4px' }}>{label}</span>
    </div>
  )
}

function VariantPicker({
  product,
  onSelect,
  onClose,
}: {
  product: Product
  onSelect: (variant: ProductVariant) => void
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      backgroundColor: 'white',
      border: '2px solid #BBCFEB',
      borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      padding: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#1D2235' }}>Escolha a variação — {product.name}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar seletor de variação"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6B7494', lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {product.variants.map(variant => {
          const label = describeVariant(variant)
          const price = variantEffectivePrice(product.price, variant)
          const stock = variant.stockQuantity ?? 0
          const isSoldOut = !variant.isAvailable || stock <= 0
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #D8DCE8',
                backgroundColor: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#1D2235',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{label}</span>
                {variant.sku && (
                  <span style={{ fontSize: '11px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>SKU: {variant.sku}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                {isSoldOut ? (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#D4849A', backgroundColor: '#FDF2F5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #D4849A' }}>
                    Esgotado · admin pode forçar
                  </span>
                ) : product.underOrder ? (
                  <span style={{ fontSize: '11px', color: '#6B7494' }}>Sob encomenda</span>
                ) : (
                  <span style={{ fontSize: '11px', color: '#6B7494' }}>{stock} em estoque</span>
                )}
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#1D2235', fontFamily: 'var(--font-mono)' }}>
                  R$ {price.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </button>
          )
        })}
      </div>
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minTotal, setMinTotal] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [searchProduct, setSearchProduct] = useState('')
  const [newOrderItems, setNewOrderItems] = useState<NewOrderItem[]>([])
  const [searchCustomer, setSearchCustomer] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [foundCustomers, setFoundCustomers] = useState<{id: string; name: string; email: string; phone: string}[]>([])
  const [variantPickerFor, setVariantPickerFor] = useState<string | null>(null)
  const [pendingActionFor, setPendingActionFor] = useState<string | null>(null)
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
      const available = (data as Product[]).filter(p => p.isActive && ((p.stock ?? 1) > 0 || p.underOrder || (p.variants && p.variants.length > 0)))
      setProducts(available)
    } catch (e) {
      console.error('Error loading products:', e)
    }
  }

  async function handleAdvanceStage(orderId: string) {
    setPendingActionFor(orderId)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, action: 'advance_stage' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error || 'Não foi possível avançar a fase')
        return
      }
      await loadOrders()
    } catch (e) {
      console.error('Error advancing stage:', e)
      alert('Erro de conexão ao avançar fase.')
    } finally {
      setPendingActionFor(null)
    }
  }

  async function handleRegressStage(orderId: string) {
    setPendingActionFor(orderId)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, action: 'regress_stage' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error || 'Não foi possível voltar a fase')
        return
      }
      await loadOrders()
    } catch (e) {
      console.error('Error regressing stage:', e)
      alert('Erro de conexão ao voltar fase.')
    } finally {
      setPendingActionFor(null)
    }
  }

  const filteredOrders = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
    const minTotalNum = minTotal ? Number(minTotal.replace(',', '.')) : null

    return orders.filter(order => {
      const matchesSearch = !searchQuery ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFulfillment = !fulfillmentFilter || order.fulfillmentStatus === fulfillmentFilter
      const matchesPayment = !paymentFilter || order.paymentStatus === paymentFilter
      const created = new Date(order.createdAt).getTime()
      const matchesFrom = !fromTs || created >= fromTs
      const matchesTo = !toTs || created <= toTs
      const matchesMinTotal = !minTotalNum || order.total >= minTotalNum
      return matchesSearch && matchesFulfillment && matchesPayment && matchesFrom && matchesTo && matchesMinTotal
    })
  }, [orders, searchQuery, fulfillmentFilter, paymentFilter, dateFrom, dateTo, minTotal])

  function handleClearFilters() {
    setSearchQuery('')
    setFulfillmentFilter('')
    setPaymentFilter('')
    setDateFrom('')
    setDateTo('')
    setMinTotal('')
  }

  function escapeCsvField(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ''
    const s = String(value)
    if (/[",\n;]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  function handleExportCsv() {
    const headers = [
      'Pedido',
      'Data',
      'Cliente',
      'E-mail',
      'Telefone',
      'CEP',
      'Cidade',
      'UF',
      'Pagamento',
      'Status',
      'Subtotal',
      'Frete',
      'Total',
      'Tracking',
    ]
    const rows = filteredOrders.map(order => [
      order.orderNumber,
      new Date(order.createdAt).toLocaleString('pt-BR'),
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      order.shippingAddress?.zipCode || '',
      order.shippingAddress?.city || '',
      order.shippingAddress?.state || '',
      order.paymentStatus,
      order.fulfillmentStatus,
      order.subtotal.toFixed(2).replace('.', ','),
      order.shippingCost.toFixed(2).replace('.', ','),
      order.total.toFixed(2).replace('.', ','),
      order.trackingCode || '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCsvField).join(';'))
      .join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    link.download = `pedidos-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const statusCounts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.paymentStatus === 'pending').length,
    paid: orders.filter(o => o.paymentStatus === 'paid').length,
    aguardandoProducao: orders.filter(o => o.fulfillmentStatus === 'aguardando_producao').length,
    production: orders.filter(o => o.fulfillmentStatus === 'in_production' || o.fulfillmentStatus === 'production').length,
    readyToShip: orders.filter(o => o.fulfillmentStatus === 'ready_to_ship').length,
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
    if (product.variants && product.variants.length > 0) {
      setVariantPickerFor(product.id)
      return
    }
    const key = itemKey(product.id, null)
    const existing = newOrderItems.find(item => itemKey(item.productId, item.variantId) === key)
    if (existing) {
      setNewOrderItems(newOrderItems.map(item =>
        itemKey(item.productId, item.variantId) === key
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setNewOrderItems([...newOrderItems, {
        productId: product.id,
        productName: product.name,
        variantId: null,
        variantName: null,
        quantity: 1,
        unitPrice: product.price,
      }])
    }
    setSearchProduct('')
  }

  const handleAddVariant = (product: Product, variant: ProductVariant) => {
    setVariantPickerFor(null)
    const vLabel = describeVariant(variant)
    const price = variantEffectivePrice(product.price, variant)
    const key = itemKey(product.id, variant.id)
    const existing = newOrderItems.find(item => itemKey(item.productId, item.variantId) === key)
    if (existing) {
      setNewOrderItems(newOrderItems.map(item =>
        itemKey(item.productId, item.variantId) === key
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setNewOrderItems([...newOrderItems, {
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantName: vLabel,
        quantity: 1,
        unitPrice: price,
      }])
    }
    setSearchProduct('')
  }

  const handleUpdateQuantity = (key: string, quantity: number) => {
    if (quantity <= 0) {
      setNewOrderItems(newOrderItems.filter(item => itemKey(item.productId, item.variantId) !== key))
    } else {
      setNewOrderItems(newOrderItems.map(item =>
        itemKey(item.productId, item.variantId) === key ? { ...item, quantity } : item
      ))
    }
  }

  const handleUpdateObservation = (key: string, observation: string) => {
    setNewOrderItems(newOrderItems.map(item =>
      itemKey(item.productId, item.variantId) === key ? { ...item, observation } : item
    ))
  }

  const handleRemoveItem = (key: string) => {
    setNewOrderItems(newOrderItems.filter(item => itemKey(item.productId, item.variantId) !== key))
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
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error || 'Erro ao criar pedido')
        return
      }

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
    setVariantPickerFor(null)
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
          <p style={{ color: '#6B7494' }}>Gerencie os pedidos da loja</p>
        </div>
        <button onClick={openCreateModal} style={{ padding: '12px 24px', backgroundColor: '#1D2235', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>+ Novo Pedido</button>
      </header>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatusCard label="Total" count={statusCounts.total} color="#1D2235" />
        <StatusCard label="Pendentes" count={statusCounts.pending} color="#F59E0B" />
        <StatusCard label="Pagos" count={statusCounts.paid} color="#10B981" />
        <StatusCard label="Aguardando Produção" count={statusCounts.aguardandoProducao} color="#94A3B8" />
        <StatusCard label="Produção" count={statusCounts.production} color="#3B82F6" />
        <StatusCard label="Enviados" count={statusCounts.shipped} color="#8B5CF6" />
        <StatusCard label="Entregues" count={statusCounts.delivered} color="#059669" />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <Input placeholder="Buscar por cliente, e-mail ou pedido..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select value={fulfillmentFilter} onChange={(e) => setFulfillmentFilter(e.target.value)} style={{ padding: '12px 16px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }}>
          <option value="">Todas as fases</option>
          {FULFILLMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ padding: '12px 16px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }}>
          <option value="">Todos Pagamentos</option>
          {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>Total mínimo (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={minTotal}
            onChange={e => setMinTotal(e.target.value)}
            placeholder="ex: 100"
            style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px', width: '140px' }}
          />
        </div>
        <button
          type="button"
          onClick={handleClearFilters}
          style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '14px' }}
        >
          Limpar filtros
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredOrders.length === 0}
          style={{
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: filteredOrders.length === 0 ? '#9CA3AF' : '#1D7A72',
            color: 'white',
            cursor: filteredOrders.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Exportar CSV ({filteredOrders.length})
        </button>
      </div>

      {orders.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ color: '#6B7494', marginBottom: '16px' }}>Nenhum pedido encontrado</p>
          <Button onClick={openCreateModal}>+ Criar Primeiro Pedido</Button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Pedido</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Cliente</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Total</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Pagamento</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Fase Atual</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Data do Pedido</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Prev. Entrega</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const fInfo = getFulfillmentInfo(order.fulfillmentStatus)
                const pInfo = getPaymentInfo(order.paymentStatus)
                const next = getNextStage(order.fulfillmentStatus)
                const previous = getPreviousStage(order.fulfillmentStatus)
                const advanceEnabled = canAdvance(order.fulfillmentStatus)
                const regressEnabled = canRegress(order.fulfillmentStatus)
                const isPending = pendingActionFor === order.id
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid #D8DCE8' }}>
                    <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{order.orderNumber}</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500 }}>{order.customerName}</div>
                      <div style={{ fontSize: '12px', color: '#6B7494' }}>{order.customerEmail}</div>
                    </td>
                    <td style={{ padding: '16px', fontWeight: 600 }}>R$ {order.total.toFixed(2).replace('.', ',')}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: (pInfo?.color || '#6B7494') + '20', color: pInfo?.color || '#6B7494' }}>
                        {pInfo?.label || order.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: (fInfo?.color || '#6B7494') + '20', color: fInfo?.color || '#6B7494' }}>
                        {fInfo?.label || order.fulfillmentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '13px', color: '#6B7494' }}>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '16px', fontSize: '13px', color: '#6B7494' }}>
                      {order.expectedDeliveryAt
                        ? new Date(order.expectedDeliveryAt).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Link href={`/admin/pedidos/${order.id}`} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #D8DCE8', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', textDecoration: 'none', color: 'inherit' }}>Ver</Link>
                        {regressEnabled && previous && (
                          <button
                            type="button"
                            onClick={() => handleRegressStage(order.id)}
                            disabled={isPending}
                            aria-label={`Voltar para ${getFulfillmentInfo(previous)?.label || previous}`}
                            title={`Voltar para ${getFulfillmentInfo(previous)?.label || previous}`}
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #D8DCE8', backgroundColor: 'white', cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '12px', color: '#6B7494', opacity: isPending ? 0.6 : 1 }}
                          >
                            ←
                          </button>
                        )}
                        {advanceEnabled && next && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStage(order.id)}
                            disabled={isPending}
                            aria-label={`Avançar para ${getFulfillmentInfo(next)?.label || next}`}
                            title={`Avançar para ${getFulfillmentInfo(next)?.label || next}`}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#1D2235', color: 'white', cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600, opacity: isPending ? 0.6 : 1 }}
                          >
                            Avançar →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(29,34,53,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '14px', maxWidth: '1100px', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(29,34,53,0.25)' }}>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #E3E9F4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Novo Pedido</h2>
                <p style={{ fontSize: '13px', color: '#6B7494', marginTop: '2px' }}>
                  Selecione produtos, informe o cliente e finalize o pedido
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Fechar"
                style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '18px', color: '#6B7494' }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

              <section style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1D2235' }}>
                      Itens do Pedido
                    </h3>
                    <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '2px' }}>
                      Catálogo à esquerda · carrinho à direita
                    </p>
                  </div>
                  {newOrderItems.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#D4849A', background: '#FDF2F5', padding: '4px 10px', borderRadius: '999px' }}>
                      {newOrderItems.reduce((s, i) => s + i.quantity, 0)} {newOrderItems.reduce((s, i) => s + i.quantity, 0) === 1 ? 'unidade' : 'unidades'}
                    </span>
                  )}
                </div>

                <div className="admin-order-split">
                  <div style={{ border: '1px solid #E3E9F4', borderRadius: '12px', backgroundColor: '#FAFCFE', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '440px' }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid #E3E9F4', backgroundColor: 'white' }}>
                      <Input
                        placeholder="Buscar produto pelo nome..."
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#6B7494', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        <span>Catálogo</span>
                        <span>{availableProducts.length} {availableProducts.length === 1 ? 'item' : 'itens'}</span>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px' }}>
                      {availableProducts.length > 0 ? (
                        availableProducts.map(product => {
                          const hasVariants = product.variants && product.variants.length > 0
                          const isSelected = newOrderItems.some(item => item.productId === product.id)
                          const isPickerOpen = variantPickerFor === product.id
                          const stockInfo = product.underOrder
                            ? { label: 'Sob encomenda', color: '#6B7494', bg: '#F0F5FB' }
                            : (product.stock ?? 0) > 0
                              ? { label: `${product.stock} em estoque`, color: '#1D7A72', bg: '#E8F5F2' }
                              : { label: 'Sem estoque', color: '#B42318', bg: '#FEE2E2' }

                          return (
                            <div key={product.id}>
                              <button
                                type="button"
                                onClick={() => handleAddProduct(product)}
                                style={{
                                  width: '100%',
                                  padding: '12px 14px',
                                  borderRadius: '10px',
                                  border: isSelected ? '1.5px solid #D4849A' : isPickerOpen ? '1.5px solid #BBCFEB' : '1px solid #E3E9F4',
                                  backgroundColor: isSelected ? '#FDF2F5' : isPickerOpen ? '#EEF4FB' : 'white',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'grid',
                                  gridTemplateColumns: '1fr auto',
                                  gap: '12px',
                                  alignItems: 'center',
                                  transition: 'all 120ms ease-out',
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#1D2235', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {product.name}
                                    </span>
                                    {isSelected && (
                                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#D4849A', background: 'white', border: '1px solid #D4849A', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                                        NO PEDIDO
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    {hasVariants ? (
                                      <span style={{ color: '#4A7AB5', fontWeight: 600 }}>
                                        {product.variants.length} variações
                                      </span>
                                    ) : (
                                      <>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1D2235' }}>
                                          R$ {product.price.toFixed(2).replace('.', ',')}
                                        </span>
                                        <span style={{ background: stockInfo.bg, color: stockInfo.color, padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
                                          {stockInfo.label}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: hasVariants ? '#BBCFEB' : '#1D2235',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                  aria-hidden="true"
                                >
                                  {hasVariants ? '⌄' : '+'}
                                </div>
                              </button>

                              {isPickerOpen && hasVariants && (
                                <div style={{ marginTop: '6px', padding: '12px', borderRadius: '10px', backgroundColor: 'white', border: '1.5px solid #BBCFEB', boxShadow: '0 4px 12px rgba(29,34,53,0.06)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '12px', color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      Escolha a variação
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setVariantPickerFor(null)}
                                      aria-label="Fechar"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#6B7494', lineHeight: 1 }}
                                    >×</button>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {product.variants.map(variant => {
                                      const label = describeVariant(variant)
                                      const price = variantEffectivePrice(product.price, variant)
                                      const stock = variant.stockQuantity ?? 0
                                      const isSoldOut = !variant.isAvailable || stock <= 0
                                      return (
                                        <button
                                          key={variant.id}
                                          type="button"
                                          onClick={() => handleAddVariant(product, variant)}
                                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E3E9F4', backgroundColor: '#FAFCFE', cursor: 'pointer', textAlign: 'left', color: '#1D2235' }}
                                        >
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{label}</span>
                                            {variant.sku && (
                                              <span style={{ fontSize: '11px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>SKU: {variant.sku}</span>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            {isSoldOut ? (
                                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#B42318', backgroundColor: '#FEE2E2', padding: '2px 8px', borderRadius: '999px' }}>Esgotado</span>
                                            ) : product.underOrder ? (
                                              <span style={{ fontSize: '11px', color: '#6B7494' }}>Sob encomenda</span>
                                            ) : (
                                              <span style={{ fontSize: '11px', color: '#1D7A72', background: '#E8F5F2', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>{stock} estoque</span>
                                            )}
                                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#1D2235', fontFamily: 'var(--font-mono)' }}>
                                              R$ {price.toFixed(2).replace('.', ',')}
                                            </span>
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ padding: '32px 16px', color: '#6B7494', textAlign: 'center', fontSize: '13px' }}>
                          {searchProduct ? 'Nenhum produto encontrado para este filtro.' : 'Nenhum produto disponível.'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ border: '1px solid #E3E9F4', borderRadius: '12px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', minHeight: '440px', maxHeight: '440px' }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid #E3E9F4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Carrinho
                      </span>
                      {newOrderItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewOrderItems([])}
                          style={{ background: 'none', border: 'none', color: '#6B7494', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          limpar
                        </button>
                      )}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                      {newOrderItems.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#6B7494', padding: '24px' }}>
                          <p style={{ fontSize: '13px', margin: 0 }}>
                            Nenhum item adicionado.
                          </p>
                          <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: '#9AA1B8' }}>
                            Clique em um produto à esquerda para começar.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {newOrderItems.map(item => {
                            const key = itemKey(item.productId, item.variantId)
                            const displayName = item.variantName
                              ? `${item.productName} · ${item.variantName}`
                              : item.productName
                            return (
                              <div key={key} style={{ padding: '12px', backgroundColor: '#FAFCFE', borderRadius: '10px', border: '1px solid #E3E9F4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                  <span style={{ flex: 1, fontWeight: 600, fontSize: '13px', color: '#1D2235', lineHeight: 1.3 }}>{displayName}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(key)}
                                    aria-label="Remover item"
                                    style={{ width: '24px', height: '24px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#B42318', fontSize: '16px', flexShrink: 0, lineHeight: 1, padding: 0 }}
                                  >×</button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', padding: '2px' }}>
                                    <button type="button" onClick={() => handleUpdateQuantity(key, item.quantity - 1)} style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '16px', color: '#1D2235' }}>−</button>
                                    <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>{item.quantity}</span>
                                    <button type="button" onClick={() => handleUpdateQuantity(key, item.quantity + 1)} style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '16px', color: '#1D2235' }}>+</button>
                                  </div>
                                  <span style={{ fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-mono)', color: '#1D2235' }}>
                                    R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Observações (cor, gravado, etc)"
                                  value={item.observation || ''}
                                  onChange={(e) => handleUpdateObservation(key, e.target.value)}
                                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E3E9F4', fontSize: '12px', backgroundColor: 'white' }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {newOrderItems.length > 0 && (
                      <div style={{ padding: '14px 16px', borderTop: '1.5px solid #1D2235', backgroundColor: '#FAFCFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7494', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subtotal</span>
                        <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#1D2235' }}>
                          R$ {orderSubtotal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </section>


              <section>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1D2235' }}>
                    Cliente & Entrega
                  </h3>
                  <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '2px' }}>
                    Busque um cliente existente ou cadastre um novo
                  </p>
                </div>

                <div style={{ position: 'relative', marginBottom: '20px' }}>
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
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: '0 8px 24px rgba(29,34,53,0.12)', marginTop: '4px' }}>
                      {foundCustomers.length > 0 ? (
                        foundCustomers.map(customer => (
                          <div key={customer.id} onClick={() => handleSelectCustomer(customer)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F0F5FB' }}>
                            <div style={{ fontWeight: 500 }}>{customer.name}</div>
                            <div style={{ fontSize: '12px', color: '#6B7494' }}>{customer.email}</div>
                          </div>
                        ))
                      ) : searchCustomer.length >= 2 && (
                        <div onClick={handleCreateNewCustomer} style={{ padding: '12px 16px', cursor: 'pointer', backgroundColor: '#F0F5FB', fontWeight: 500 }}>
                          + Criar novo cliente: {searchCustomer}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="admin-order-form-grid">
                  <Input label="Nome do cliente" value={newOrderForm.customerName} onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })} required />
                  <Input label="E-mail" type="email" value={newOrderForm.customerEmail} onChange={(e) => setNewOrderForm({ ...newOrderForm, customerEmail: e.target.value })} required />
                  <Input label="Telefone" value={newOrderForm.customerPhone} onChange={(e) => setNewOrderForm({ ...newOrderForm, customerPhone: e.target.value })} required placeholder="(11) 99999-9999" />
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <Input label="CEP" value={newOrderForm.zipCode} onChange={(e) => setNewOrderForm({ ...newOrderForm, zipCode: e.target.value })} required placeholder="00000-000" style={{ flex: 1 }} />
                    <button onClick={handleViaCep} disabled={cepLoading} style={{ padding: '11px 14px', backgroundColor: '#1D2235', color: 'white', border: 'none', borderRadius: '6px', cursor: cepLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px' }}>
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
              </section>
            </div>

            <div style={{ padding: '16px 28px', borderTop: '1px solid #E3E9F4', backgroundColor: '#FAFCFE', display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', color: '#6B7494' }}>
                {newOrderItems.length === 0
                  ? 'Adicione ao menos um item para criar o pedido'
                  : (
                    <>
                      <strong style={{ color: '#1D2235', fontFamily: 'var(--font-mono)' }}>R$ {orderSubtotal.toFixed(2).replace('.', ',')}</strong>
                      <span> · {newOrderItems.length} {newOrderItems.length === 1 ? 'produto' : 'produtos'}</span>
                    </>
                  )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
                <button
                  onClick={handleCreateOrder}
                  disabled={newOrderItems.length === 0}
                  style={{ padding: '10px 24px', backgroundColor: newOrderItems.length === 0 ? '#9AA1B8' : '#1D2235', border: 'none', borderRadius: '8px', cursor: newOrderItems.length === 0 ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 600, opacity: newOrderItems.length === 0 ? 0.6 : 1 }}
                >
                  Criar Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
