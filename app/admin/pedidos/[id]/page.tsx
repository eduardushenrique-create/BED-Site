'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
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
  items: { productId: string; productName: string; quantity: number; unitPrice: number }[]
  trackingCode: string | null
}

type Product = {
  id: string
  name: string
  price: number
  stock?: number
  underOrder?: boolean
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

function Card({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>{title}</h2>
      {children}
    </div>
  )
}

function StatusBadge({ status, options }: { status: string, options: { value: string, label: string, color: string }[] }) {
  const info = options.find(s => s.value === status)
  if (!info) return null
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: `${info.color}20`, color: info.color }}>
      {info.label}
    </span>
  )
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showTrackingInput, setShowTrackingInput] = useState(false)
  const [showEditItemsModal, setShowEditItemsModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [editingItems, setEditingItems] = useState<{productId: string; productName: string; quantity: number; unitPrice: number}[]>([])
    
  const [formData, setFormData] = useState({
    fulfillmentStatus: '',
    paymentStatus: '',
    trackingCode: '',
  })

  async function loadOrder() {
    setLoading(true)
    try {
      const res = await fetch('/api/pedidos')
      const orders = await res.json()
      const found = orders.find((o: Order) => o.id === resolvedParams.id) || orders.find((o: Order) => o.orderNumber === resolvedParams.id)
      if (found) {
        setOrder(found)
        setFormData({
          fulfillmentStatus: found.fulfillmentStatus,
          paymentStatus: found.paymentStatus,
          trackingCode: found.trackingCode || '',
        })
        setEditingItems(found.items)
      }
    } catch (e) {
      console.error('Error loading order:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        const [ordersRes, productsRes] = await Promise.all([
          fetch('/api/pedidos'),
          fetch('/api/produtos'),
        ])
        const orders = await ordersRes.json()
        const productsData = await productsRes.json()

        if (cancelled) return

        const found = orders.find((o: Order) => o.id === resolvedParams.id) || orders.find((o: Order) => o.orderNumber === resolvedParams.id)
        if (found) {
          setOrder(found)
          setFormData({
            fulfillmentStatus: found.fulfillmentStatus,
            paymentStatus: found.paymentStatus,
            trackingCode: found.trackingCode || '',
          })
          setEditingItems(found.items)
        }
        setProducts(productsData.filter((p: Product) => p.isActive && ((p.stock ?? 1) > 0 || p.underOrder)))
      } catch (e) {
        console.error('Error loading order detail:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInitialData()
    return () => {
      cancelled = true
    }
  }, [resolvedParams.id])

  const isCancelled = order?.status === 'cancelled' || order?.fulfillmentStatus === 'cancelled'
    
  const hasChanges = 
    formData.fulfillmentStatus !== (order?.fulfillmentStatus || '') ||
    formData.paymentStatus !== (order?.paymentStatus || '') ||
    formData.trackingCode !== (order?.trackingCode || '')

  const handleSave = async () => {
    if (!order) return
    setSaving(true)
    
    try {
      await fetch('/api/pedidos', {
        method: 'PUT',
        body: JSON.stringify({
          id: order.id,
          fulfillmentStatus: formData.fulfillmentStatus,
          paymentStatus: formData.paymentStatus,
          trackingCode: formData.trackingCode || null,
        }),
      })
      alert('Pedido atualizado!')
      loadOrder()
    } catch (e) {
      console.error('Error saving order:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmail = () => {
    if (!order) return
    const subject = encodeURIComponent(`Pedido ${order.orderNumber} - Forma 3D`)
    const statusLabel = fulfillmentStatuses.find(s => s.value === order.fulfillmentStatus)?.label || order.fulfillmentStatus
    const body = encodeURIComponent(
      `Olá ${order.customerName}!\n\nSeu pedido ${order.orderNumber} está com status: ${statusLabel}.\n\nValor: R$ ${order.total.toFixed(2).replace('.', ',')}\n\nObrigado!\nForma 3D`
    )
    window.open(`mailto:${order.customerEmail}?subject=${subject}&body=${body}`)
  }

  const handleSendWhatsApp = () => {
    if (!order) return
    const phone = order.customerPhone.replace(/\D/g, '')
    const statusLabel = fulfillmentStatuses.find(s => s.value === order.fulfillmentStatus)?.label || order.fulfillmentStatus
    const message = encodeURIComponent(`Olá ${order.customerName}! 👋\n\nSeu pedido *${order.orderNumber}* está com status: *${statusLabel}*\n\nValor: R$ ${order.total.toFixed(2).replace('.', ',')}\n\nObrigado! Forma 3D`)
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  const handlePrintLabel = () => {
    if (!order) return
    const labelContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiqueta - ${order.orderNumber}</title></head><body style="font-family:Arial;padding:20px;max-width:400px"><div style="border:2px solid #333;padding:15px"><div style="border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px;display:flex;justify-content:space-between"><div style="font-size:18px;font-weight:bold;color:#C8552A">FORMA 3D</div><div style="font-size:12px;color:#666">${order.orderNumber}</div></div><div><h3 style="margin:0 0 8px 0;font-size:14px;text-transform:uppercase;color:#666">Destinatário</h3><div style="font-size:13px;line-height:1.4"><strong>${order.customerName}</strong><br>${order.shippingAddress.street}, ${order.shippingAddress.number}<br>${order.shippingAddress.complement || ''}<br>${order.shippingAddress.neighborhood}<br>${order.shippingAddress.city} - ${order.shippingAddress.state}<br>CEP: ${order.shippingAddress.zipCode}</div></div><div style="text-align:center;margin:15px 0;padding:10px;border:1px dashed #999;background:#f9f9f9"><strong>${order.trackingCode || 'SEM RASTREAMENTO'}</strong></div></div></body></html>`
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(labelContent)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 250)
    }
  }

  const handleEditItemsSave = async () => {
    if (!order) return
    const newSubtotal = editingItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
    try {
      await fetch('/api/pedidos', {
        method: 'PUT',
        body: JSON.stringify({
          id: order.id,
          items: editingItems,
          subtotal: newSubtotal,
          total: newSubtotal + order.shippingCost,
        }),
      })
      setShowEditItemsModal(false)
      alert('Itens atualizados!')
      loadOrder()
    } catch (e) {
      console.error('Error saving items:', e)
    }
  }

  const handleCloneOrder = async () => {
    if (!order) return
    const orderData = {
      orderNumber: `BD-${Date.now().toString(36).toUpperCase()}`,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      total: order.total,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      paymentMethod: order.paymentMethod,
      createdAt: new Date().toISOString(),
      items: editingItems,
      trackingCode: null,
    }
    try {
      await fetch('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(orderData),
      })
      setShowCloneModal(false)
      alert('Pedido clonado!')
    } catch (e) {
      console.error('Error cloning order:', e)
    }
  }

  const handleRemoveItem = (productId: string) => {
    setEditingItems(editingItems.filter(item => item.productId !== productId))
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setEditingItems(editingItems.filter(item => item.productId !== productId))
    } else {
      setEditingItems(editingItems.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      ))
    }
  }

  const handleAddProduct = (product: Product) => {
    const existing = editingItems.find(item => item.productId === product.id)
    if (existing) {
      setEditingItems(editingItems.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setEditingItems([...editingItems, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      }])
    }
  }

  const handleCancelOrder = async () => {
    if (!order) return
    try {
      await fetch('/api/pedidos', {
        method: 'PUT',
        body: JSON.stringify({
          id: order.id,
          fulfillmentStatus: 'cancelled',
          paymentStatus: 'refunded',
        }),
      })
      setShowCancelModal(false)
      alert('Pedido cancelado!')
      loadOrder()
    } catch (e) {
      console.error('Error canceling order:', e)
    }
  }

  const calculateNewTotal = () => {
    if (!order) return 0
    return editingItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) + order.shippingCost
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Carregando...</div>
  }

  if (!order) {
    return (
      <div>
        <h1>Pedido não encontrado</h1>
        <Link href="/admin/pedidos" style={{ color: '#C8552A' }}>← Voltar aos pedidos</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/pedidos" style={{ color: '#78716C', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          ← Voltar aos pedidos
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
            Pedido <span style={{ fontFamily: 'var(--font-mono)' }}>{order.orderNumber}</span>
          </h1>
          <p style={{ color: '#78716C', marginTop: '4px' }}>
            Criado em {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <StatusBadge status={formData.fulfillmentStatus} options={fulfillmentStatuses} />
          {hasChanges && <span style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 500 }}>⚠️ Alterações pendentes</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card title="Cliente">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><p style={{ fontSize: '14px', color: '#78716C' }}>Nome</p><p style={{ fontWeight: 500 }}>{order.customerName}</p></div>
              <div><p style={{ fontSize: '14px', color: '#78716C' }}>E-mail</p><p>{order.customerEmail}</p></div>
              <div><p style={{ fontSize: '14px', color: '#78716C' }}>Telefone</p><p>{order.customerPhone}</p></div>
            </div>
          </Card>

          <Card title="Endereço de Entrega">
            <p style={{ lineHeight: 1.6 }}>
              {order.shippingAddress.street}, {order.shippingAddress.number}<br />
              {order.shippingAddress.complement && <>{order.shippingAddress.complement}<br /></>}
              {order.shippingAddress.neighborhood}<br />
              {order.shippingAddress.city} - {order.shippingAddress.state}<br />
              CEP: {order.shippingAddress.zipCode}
            </p>
          </Card>

          <Card title="Pagamento">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '14px', color: '#78716C' }}>Status</p>
                <StatusBadge status={formData.paymentStatus} options={paymentStatuses} />
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#78716C' }}>Método</p>
                <p style={{ textTransform: 'capitalize' }}>{order.paymentMethod}</p>
              </div>
              {!isCancelled && (
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Atualizar pagamento</label>
                  <select value={formData.paymentStatus} onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E8E2DA', fontSize: '14px', backgroundColor: 'white' }}>
                    {paymentStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </Card>

          <Card title="Itens do Pedido">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {order.items.length === 0 ? (
                <p style={{ color: '#78716C' }}>Nenhum item</p>
              ) : (
                order.items.map((item, idx) => (
                  <div key={idx} style={{ padding: '16px 0', borderBottom: idx < order.items.length - 1 ? '1px solid #E8E2DA' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div><p style={{ fontWeight: 500 }}>{item.productName}</p><p style={{ fontSize: '14px', color: '#78716C' }}>Qty: {item.quantity} × R$ {item.unitPrice.toFixed(2).replace('.', ',')}</p></div>
                      <p style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                ))
              )}
              <div style={{ padding: '16px 0', borderTop: '2px solid #E8E2DA', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#78716C' }}><span>Subtotal</span><span style={{ fontFamily: 'var(--font-mono)' }}>R$ {order.subtotal.toFixed(2).replace('.', ',')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#78716C' }}><span>Frete</span><span style={{ fontFamily: 'var(--font-mono)' }}>R$ {order.shippingCost.toFixed(2).replace('.', ',')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}><span>Total</span><span style={{ fontFamily: 'var(--font-mono)' }}>R$ {order.total.toFixed(2).replace('.', ',')}</span></div>
              </div>
            </div>
          </Card>

          <Card title="Status & Logística">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Status do pedido</label>
                <select value={formData.fulfillmentStatus} onChange={(e) => setFormData({ ...formData, fulfillmentStatus: e.target.value })} disabled={isCancelled} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E8E2DA', fontSize: '14px', backgroundColor: isCancelled ? '#F5F2EE' : 'white', color: isCancelled ? '#78716C' : 'inherit' }}>
                  {fulfillmentStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#78716C', marginBottom: '8px' }}>Código de rastreamento</p>
                {order.trackingCode || formData.trackingCode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <code style={{ padding: '8px 12px', backgroundColor: '#F5F2EE', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{formData.trackingCode || order.trackingCode}</code>
                    <a href={`https://www.correios.com.br/rastreamento?n=${formData.trackingCode || order.trackingCode}`} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#3B82F6', color: 'white', borderRadius: '6px', fontSize: '13px', textDecoration: 'none' }}>Rastrear</a>
                  </div>
                ) : !isCancelled && (
                  <>
                    {showTrackingInput ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input type="text" value={formData.trackingCode} onChange={(e) => setFormData({ ...formData, trackingCode: e.target.value })} placeholder="Ex: PAC123456789BR" style={{ flex: 1, minWidth: '200px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E8E2DA', fontSize: '14px' }} />
                        <button onClick={() => setShowTrackingInput(false)} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowTrackingInput(true)} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>+ Adicionar código de rastreamento</button>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          {!isCancelled && (
            <Button onClick={handleSave} disabled={!hasChanges || saving} style={{ width: '100%' }}>
              {saving ? 'Salvando...' : hasChanges ? 'Salvar Alterações' : 'Nenhuma alteração'}
            </Button>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={handleSendEmail} disabled={isCancelled} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', cursor: isCancelled ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isCancelled ? 0.5 : 1 }}>📧 E-mail</button>
            <button onClick={handleSendWhatsApp} disabled={isCancelled} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#25D366', border: 'none', borderRadius: '8px', cursor: isCancelled ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isCancelled ? 0.5 : 1 }}>💬 WhatsApp</button>
            <button onClick={handlePrintLabel} disabled={isCancelled} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', cursor: isCancelled ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isCancelled ? 0.5 : 1 }}>🖨️ Etiqueta</button>
            {!isCancelled && (
              <button onClick={() => setShowCancelModal(true)} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>❌ Cancelar</button>
            )}
          </div>

          {!isCancelled && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button onClick={() => { setEditingItems([...order.items]); setShowEditItemsModal(true) }} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#3B82F6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>✏️ Editar Itens</button>
              <button onClick={() => setShowCloneModal(true)} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#8B5CF6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>📋 Clonar Pedido</button>
            </div>
          )}
        </div>
      </div>

      {showEditItemsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Editar Itens do Pedido</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {editingItems.map((item) => (
                <div key={item.productId} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', backgroundColor: '#F5F2EE', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}><p style={{ fontWeight: 500 }}>{item.productName}</p><p style={{ fontSize: '14px', color: '#78716C' }}>R$ {item.unitPrice.toFixed(2).replace('.', ',')}</p></div>
                  <input type="number" min="1" value={item.quantity} onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 1)} style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #E8E2DA' }} />
                  <button onClick={() => handleRemoveItem(item.productId)} style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '6px', cursor: 'pointer', color: '#EF4444' }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', border: '1px solid #E8E2DA', borderRadius: '10px', padding: '12px' }}>
              {products.length > 0 ? (
                products.map(product => {
                  const selected = editingItems.some(item => item.productId === product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: selected ? '1px solid #C8552A' : '1px solid #E8E2DA',
                        backgroundColor: selected ? '#C8552A12' : 'white',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'block', fontWeight: 600 }}>{product.name}</span>
                      <span style={{ display: 'block', color: '#78716C', fontSize: '13px', marginTop: '2px' }}>
                        R$ {product.price.toFixed(2).replace('.', ',')} {product.underOrder ? '· sob encomenda' : `· estoque ${product.stock ?? 'n/d'}`}
                      </span>
                      <span style={{ display: 'block', color: '#C8552A', fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>
                        {selected ? 'Adicionar mais uma unidade' : '+ Adicionar ao pedido'}
                      </span>
                    </button>
                  )
                })
              ) : (
                <div style={{ padding: '16px', color: '#78716C', textAlign: 'center', gridColumn: '1 / -1' }}>
                  Nenhum produto disponivel.
                </div>
              )}
            </div>
            <div style={{ padding: '16px', backgroundColor: '#F5F2EE', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Novo Total:</span><span>R$ {calculateNewTotal().toFixed(2).replace('.', ',')}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditItemsModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleEditItemsSave} style={{ padding: '10px 20px', backgroundColor: '#3B82F6', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}>Salvar Itens</button>
            </div>
          </div>
        </div>
      )}

      {showCloneModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Clonar Pedido?</h2>
            <p style={{ color: '#78716C', marginBottom: '24px' }}>Esta ação ira criar um novo pedido com os mesmos dados.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCloneModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCloneOrder} style={{ padding: '10px 20px', backgroundColor: '#8B5CF6', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}>Sim, clonar</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Cancelar pedido?</h2>
            <p style={{ color: '#78716C', marginBottom: '24px' }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCancelModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #E8E2DA', borderRadius: '8px', cursor: 'pointer' }}>Manter pedido</button>
              <button onClick={handleCancelOrder} style={{ padding: '10px 20px', backgroundColor: '#EF4444', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}>Sim, cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
