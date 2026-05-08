'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/Button'
import OrderMaterialsCard from '@/components/admin/OrderMaterialsCard'
import { variantEffectivePrice, describeVariant } from '@/lib/products/variant-pricing'
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  getEffectivePipeline,
  getFulfillmentInfo,
  getNextStage,
  getOrderTypeFromOrder,
  getPreviousStage,
  canAdvance,
  canRegress,
  listTimelineEntries,
  type DeliveryMethod,
  type FulfillmentStatus,
  type OrderType,
  type ProductionTimeline,
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

type OrderItem = {
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  quantity: number
  unitPrice: number
  observation?: string
  // Flags do produto exigidas para classificar o pipeline (sob_encomenda
  // vs pronta_entrega) via getOrderType().
  underOrder?: boolean
  isPersonalizable?: boolean
}

type Order = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  // Pipeline-redesign: pedido com retirada nao tem endereco.
  shippingAddress: {
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  } | null
  deliveryMethod?: 'shipping' | 'pickup' | null
  // Persistido: 'sob_encomenda' | 'pronta_entrega'. Pode estar ausente em
  // pedidos legados criados antes da migration.
  orderType?: 'sob_encomenda' | 'pronta_entrega' | null
  total: number
  subtotal: number
  shippingCost: number
  discountTotal?: number
  couponCode?: string | null
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  paymentMethod: string
  createdAt: string
  items: OrderItem[]
  trackingCode: string | null
  expectedDeliveryAt?: string | null
  productionTimeline?: ProductionTimeline | null
  currentStageNote?: string | null
}

function itemKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? ''}`
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

function normalizeItems(items: unknown[]): OrderItem[] {
  return (items || []).map(raw => {
    const item = raw as Record<string, unknown>
    return ({
    productId: String(item.productId),
    productName: String(item.productName),
    variantId: (item.variantId as string | null | undefined) ?? null,
    variantName: (item.variantName as string | null | undefined) ?? null,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    observation: item.observation as string | undefined,
  })
  })
}

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

function toLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return ''
    const offsetMs = d.getTimezoneOffset() * 60 * 1000
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

// Mensagens consumidas a partir de response.production.warning vindo do
// PUT /api/pedidos. O backend (ensureProductionTasksForOrder) sinaliza
// quando a transicao para fase de producao nao gerou tasks novas, e por
// que. Sem esse alerta, o admin avanca o pedido e depois nao entende por
// que a tabela /admin/producao continua vazia.
const PRODUCTION_WARNINGS: Record<string, string> = {
  no_eligible_items:
    'Pedido movido, mas nenhum item possui marcação de produção (sob encomenda ou personalizável). Revise os produtos para que apareçam na tabela de produção.',
  not_in_production_phase:
    'Pedido movido, mas ainda não está em uma fase produtiva (Liberado para produção / Em produção). As tarefas serão criadas quando avançar.',
  already_exists:
    'Tarefas de produção já existiam para este pedido — nada novo foi criado.',
  error:
    'Pedido movido, mas falhou ao gerar as tarefas de produção. Tente o botão "Sincronizar" no painel de produção.',
}

type ProductionTriggerSummary = {
  tasksCreated?: number
  warning?: string
  unpaid?: boolean
  error?: boolean
} | null | undefined

function announceProductionTrigger(trigger: ProductionTriggerSummary) {
  if (!trigger) return
  if (trigger.error) {
    alert(PRODUCTION_WARNINGS.error)
    return
  }
  if (trigger.warning && PRODUCTION_WARNINGS[trigger.warning]) {
    alert(PRODUCTION_WARNINGS[trigger.warning])
    return
  }
  if (typeof trigger.tasksCreated === 'number' && trigger.tasksCreated > 0) {
    const created = trigger.tasksCreated
    const unpaidNote = trigger.unpaid
      ? '\n\nAtenção: o pagamento deste pedido ainda não foi confirmado. As tarefas foram criadas mesmo assim (pagamento na entrega/retirada).'
      : ''
    alert(`Pedido movido. ${created} tarefa(s) de produção criada(s).${unpaidNote}`)
  }
}

/**
 * Linha do tempo visual do pipeline. Mostra todas as fases pelas quais o
 * pedido vai passar (resolvidas conforme tipo do pedido + deliveryMethod),
 * com 3 estados visuais por fase:
 *
 *   - DONE   (verde, com check): fase ja foi atingida.
 *   - CURRENT (azul, com pulso): fase atual, em destaque.
 *   - FUTURE (cinza claro): fase ainda nao alcancada.
 *
 * Pedido cancelado vira um banner unico cinza-vermelho.
 */
function PipelineTimeline({
  type,
  deliveryMethod,
  currentStatus,
  productionTimeline,
}: {
  type: OrderType
  deliveryMethod: DeliveryMethod
  currentStatus: string
  productionTimeline: ProductionTimeline | Record<string, string | null> | null | undefined
}) {
  const isCancelled = currentStatus === 'cancelled'

  if (isCancelled) {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '24px', borderLeft: '4px solid #EF4444' }}>
        <p style={{ margin: 0, fontWeight: 600, color: '#EF4444' }}>Pedido cancelado</p>
        <p style={{ margin: '4px 0 0 0', color: '#6B7494', fontSize: '13px' }}>Não há mais transições previstas para este pedido.</p>
      </div>
    )
  }

  const pipeline = getEffectivePipeline(type, deliveryMethod)
  const currentIdx = pipeline.indexOf(currentStatus as FulfillmentStatus)
  const typeLabel = type === 'pronta_entrega' ? 'Pronta entrega' : 'Sob encomenda'
  const methodLabel = deliveryMethod === 'pickup' ? 'Retirada' : 'Envio'

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Linha do tempo do pedido
        </h2>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', backgroundColor: type === 'sob_encomenda' ? '#E8F0FB' : '#DFF4EC', color: type === 'sob_encomenda' ? '#4A7AB5' : '#0E9F6E', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {typeLabel}
          </span>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', backgroundColor: '#F0F5FB', color: '#6B7494', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {methodLabel}
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <ol style={{ display: 'flex', alignItems: 'flex-start', gap: 0, listStyle: 'none', padding: 0, margin: 0, minWidth: 'min-content' }}>
          {pipeline.map((status, idx) => {
            const info = getFulfillmentInfo(status)
            const isDone = currentIdx > idx
            const isCurrent = currentIdx === idx
            const isFuture = currentIdx < idx

            const dotBg = isCurrent ? (info?.color || '#1D2235') : isDone ? '#0E9F6E' : '#FFFFFF'
            const dotBorder = isFuture ? '#D8DCE8' : 'transparent'
            const dotColor = isCurrent || isDone ? 'white' : '#9AA1B8'
            const labelColor = isCurrent ? '#1D2235' : isDone ? '#0E9F6E' : '#9AA1B8'
            const labelWeight = isCurrent ? 700 : isDone ? 500 : 400

            const timelineKey = info?.timelineKey
            const stamp = timelineKey && productionTimeline
              ? (productionTimeline as Record<string, string | null>)[timelineKey]
              : null
            const stampLabel = stamp ? formatTimelineDate(stamp) : null

            const isLast = idx === pipeline.length - 1

            return (
              <li key={status} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? '0 0 auto' : 1, minWidth: '110px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', minWidth: '110px' }}>
                  <div
                    aria-current={isCurrent ? 'step' : undefined}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: dotBg,
                      border: `2px solid ${dotBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: dotColor,
                      fontSize: '14px',
                      fontWeight: 700,
                      boxShadow: isCurrent ? `0 0 0 4px ${(info?.color || '#1D2235')}26` : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <div style={{ marginTop: '8px', textAlign: 'center', padding: '0 4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: labelWeight, color: labelColor, lineHeight: 1.3 }}>
                      {info?.label || status}
                    </div>
                    {stampLabel && (
                      <div style={{ fontSize: '10px', color: '#9AA1B8', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        {stampLabel}
                      </div>
                    )}
                  </div>
                </div>
                {!isLast && (
                  <div style={{ flex: 1, height: '2px', backgroundColor: isDone ? '#0E9F6E' : '#E3E9F4', marginTop: '15px' }} />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function formatTimelineDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return ''
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showTrackingInput, setShowTrackingInput] = useState(false)
  const [showEditItemsModal, setShowEditItemsModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [advanceNote, setAdvanceNote] = useState('')
  const [stageActionLoading, setStageActionLoading] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [refundError, setRefundError] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingItems, setEditingItems] = useState<OrderItem[]>([])
  const [variantPickerFor, setVariantPickerFor] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    fulfillmentStatus: '',
    paymentStatus: '',
    trackingCode: '',
    expectedDeliveryAt: '',
  })

  async function loadOrder() {
    setLoading(true)
    try {
      const res = await fetch(`/api/pedidos/${encodeURIComponent(resolvedParams.id)}`, { cache: 'no-store' })
      if (!res.ok) {
        setOrder(null)
        return
      }
      const found: Order = await res.json()
      setOrder(found)
      setFormData({
        fulfillmentStatus: found.fulfillmentStatus,
        paymentStatus: found.paymentStatus,
        trackingCode: found.trackingCode || '',
        expectedDeliveryAt: toLocalDateTimeInput(found.expectedDeliveryAt),
      })
      setEditingItems(normalizeItems(found.items))
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
        const [orderRes, productsRes] = await Promise.all([
          fetch(`/api/pedidos/${encodeURIComponent(resolvedParams.id)}`, { cache: 'no-store' }),
          fetch('/api/produtos', { cache: 'no-store' }),
        ])

        if (cancelled) return

        if (orderRes.ok) {
          const found: Order = await orderRes.json()
          setOrder(found)
          setFormData({
            fulfillmentStatus: found.fulfillmentStatus,
            paymentStatus: found.paymentStatus,
            trackingCode: found.trackingCode || '',
            expectedDeliveryAt: toLocalDateTimeInput(found.expectedDeliveryAt),
          })
          setEditingItems(normalizeItems(found.items))
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json()
          if (Array.isArray(productsData)) {
            setProducts(
              (productsData as Product[]).filter(
                p => p.isActive && ((p.stock ?? 1) > 0 || p.underOrder || (p.variants && p.variants.length > 0)),
              ),
            )
          }
        }
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
    formData.trackingCode !== (order?.trackingCode || '') ||
    formData.expectedDeliveryAt !== toLocalDateTimeInput(order?.expectedDeliveryAt)

  const handleSave = async () => {
    if (!order) return
    setSaving(true)

    try {
      const expectedIso = formData.expectedDeliveryAt
        ? new Date(formData.expectedDeliveryAt).toISOString()
        : null

      const res = await fetch('/api/pedidos', {
        method: 'PUT',
        body: JSON.stringify({
          id: order.id,
          fulfillmentStatus: formData.fulfillmentStatus,
          paymentStatus: formData.paymentStatus,
          trackingCode: formData.trackingCode || null,
          expectedDeliveryAt: expectedIso,
        }),
      })
      const updated = res.ok ? await res.json().catch(() => null) : null
      if (updated?.production) {
        announceProductionTrigger(updated.production)
      } else {
        alert('Pedido atualizado!')
      }
      loadOrder()
    } catch (e) {
      console.error('Error saving order:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleAdvanceStageConfirm = async () => {
    if (!order) return
    setStageActionLoading(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          action: 'advance_stage',
          currentStageNote: advanceNote.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error || 'Não foi possível avançar a fase')
        return
      }
      const updated = await res.json().catch(() => null)
      announceProductionTrigger(updated?.production)
      setShowAdvanceModal(false)
      setAdvanceNote('')
      loadOrder()
    } catch (e) {
      console.error('Error advancing stage:', e)
      alert('Erro de conexão ao avançar fase.')
    } finally {
      setStageActionLoading(false)
    }
  }

  const handleRegressStage = async () => {
    if (!order) return
    setStageActionLoading(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          action: 'regress_stage',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error || 'Não foi possível voltar a fase')
        return
      }
      loadOrder()
    } catch (e) {
      console.error('Error regressing stage:', e)
      alert('Erro de conexão ao voltar fase.')
    } finally {
      setStageActionLoading(false)
    }
  }

  const handleDeleteOrder = async () => {
    if (!order) return
    if (deleteConfirmInput.trim() !== order.orderNumber) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/pedidos?id=${encodeURIComponent(order.id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Erro ao excluir pedido.')
        return
      }
      router.push('/admin/pedidos')
    } catch (e) {
      console.error('Error deleting order:', e)
      alert('Erro de conexão ao excluir.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSendEmail = () => {
    if (!order) return
    const subject = encodeURIComponent(`Pedido ${order.orderNumber} - Forma 3D`)
    const statusLabel = getFulfillmentInfo(order.fulfillmentStatus)?.label || order.fulfillmentStatus
    const body = encodeURIComponent(
      `Olá ${order.customerName}!\n\nSeu pedido ${order.orderNumber} está com status: ${statusLabel}.\n\nValor: R$ ${order.total.toFixed(2).replace('.', ',')}\n\nObrigado!\nForma 3D`
    )
    window.open(`mailto:${order.customerEmail}?subject=${subject}&body=${body}`)
  }

  const handleSendWhatsApp = () => {
    if (!order) return
    const phone = order.customerPhone.replace(/\D/g, '')
    const statusLabel = getFulfillmentInfo(order.fulfillmentStatus)?.label || order.fulfillmentStatus
    const message = encodeURIComponent(`Olá ${order.customerName}!\n\nSeu pedido *${order.orderNumber}* está com status: *${statusLabel}*\n\nValor: R$ ${order.total.toFixed(2).replace('.', ',')}\n\nObrigado! Forma 3D`)
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  const handlePrintLabel = () => {
    if (!order) return
    if (!order.shippingAddress) {
      alert('Pedido com retirada no local não tem endereço para etiqueta.')
      return
    }
    const addr = order.shippingAddress
    const labelContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiqueta - ${order.orderNumber}</title></head><body style="font-family:Arial;padding:20px;max-width:400px"><div style="border:2px solid #333;padding:15px"><div style="border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px;display:flex;justify-content:space-between"><div style="font-size:18px;font-weight:bold;color:#D4849A">FORMA 3D</div><div style="font-size:12px;color:#666">${order.orderNumber}</div></div><div><h3 style="margin:0 0 8px 0;font-size:14px;text-transform:uppercase;color:#666">Destinatário</h3><div style="font-size:13px;line-height:1.4"><strong>${order.customerName}</strong><br>${addr.street}, ${addr.number}<br>${addr.complement || ''}<br>${addr.neighborhood}<br>${addr.city} - ${addr.state}<br>CEP: ${addr.zipCode}</div></div><div style="text-align:center;margin:15px 0;padding:10px;border:1px dashed #999;background:#f9f9f9"><strong>${order.trackingCode || 'SEM RASTREAMENTO'}</strong></div></div></body></html>`
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

  const handleRemoveItem = (key: string) => {
    setEditingItems(editingItems.filter(item => itemKey(item.productId, item.variantId) !== key))
  }

  const handleUpdateQuantity = (key: string, quantity: number) => {
    if (quantity <= 0) {
      setEditingItems(editingItems.filter(item => itemKey(item.productId, item.variantId) !== key))
    } else {
      setEditingItems(editingItems.map(item =>
        itemKey(item.productId, item.variantId) === key ? { ...item, quantity } : item
      ))
    }
  }

  const handleAddProduct = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      setVariantPickerFor(product.id)
      return
    }
    const key = itemKey(product.id, null)
    const existing = editingItems.find(item => itemKey(item.productId, item.variantId) === key)
    if (existing) {
      setEditingItems(editingItems.map(item =>
        itemKey(item.productId, item.variantId) === key
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setEditingItems([...editingItems, {
        productId: product.id,
        productName: product.name,
        variantId: null,
        variantName: null,
        quantity: 1,
        unitPrice: product.price,
      }])
    }
  }

  const handleAddVariant = (product: Product, variant: ProductVariant) => {
    setVariantPickerFor(null)
    const vLabel = describeVariant(variant)
    const price = variantEffectivePrice(product.price, variant)
    const key = itemKey(product.id, variant.id)
    const existing = editingItems.find(item => itemKey(item.productId, item.variantId) === key)
    if (existing) {
      setEditingItems(editingItems.map(item =>
        itemKey(item.productId, item.variantId) === key
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setEditingItems([...editingItems, {
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantName: vLabel,
        quantity: 1,
        unitPrice: price,
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

  const handleRefundOrder = async () => {
    if (!order) return
    setRefunding(true)
    setRefundError('')
    try {
      const res = await fetch(`/api/pedidos/${encodeURIComponent(order.id)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setRefundError(data?.error || 'Não foi possível estornar o pedido.')
        return
      }
      setShowRefundModal(false)
      alert(`Estorno solicitado ao Mercado Pago. Status: ${data.paymentStatus || 'refunded'}.`)
      loadOrder()
    } catch (e) {
      console.error('Error refunding order:', e)
      setRefundError('Erro de conexão ao processar estorno.')
    } finally {
      setRefunding(false)
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
        <Link href="/admin/pedidos" style={{ color: '#D4849A' }}>← Voltar aos pedidos</Link>
      </div>
    )
  }

  // Pipeline aplicavel depende do tipo de pedido e metodo de entrega; passar
  // ao helper para que Avancar/Voltar levem para a fase correta de cada fluxo.
  // getOrderTypeFromOrder le do campo persistido `Order.orderType` (preferido)
  // e cai no fallback de derivar pelos items se o campo nao estiver populado.
  const stageOptions = {
    type: getOrderTypeFromOrder(order as Parameters<typeof getOrderTypeFromOrder>[0]),
    deliveryMethod: ((order as unknown as { deliveryMethod?: string | null })
      .deliveryMethod || 'shipping') as DeliveryMethod,
  }

  const nextStage = getNextStage(order.fulfillmentStatus, stageOptions)
  const previousStage = getPreviousStage(order.fulfillmentStatus, stageOptions)
  const advanceEnabled = canAdvance(order.fulfillmentStatus, stageOptions) && !isCancelled
  const regressEnabled = canRegress(order.fulfillmentStatus, stageOptions) && !isCancelled
  const nextStageInfo = nextStage ? getFulfillmentInfo(nextStage) : null
  const previousStageInfo = previousStage ? getFulfillmentInfo(previousStage) : null
  const timelineEntries = listTimelineEntries(order.productionTimeline)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/pedidos" style={{ color: '#6B7494', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          ← Voltar aos pedidos
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
            Pedido <span style={{ fontFamily: 'var(--font-mono)' }}>{order.orderNumber}</span>
          </h1>
          <p style={{ color: '#6B7494', marginTop: '4px' }}>
            Criado em {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <StatusBadge status={formData.fulfillmentStatus} options={FULFILLMENT_STATUSES} />
          {hasChanges && <span style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 500 }}>Alterações pendentes</span>}
        </div>
      </div>

      <PipelineTimeline
        type={stageOptions.type}
        deliveryMethod={stageOptions.deliveryMethod}
        currentStatus={order.fulfillmentStatus}
        productionTimeline={order.productionTimeline}
      />

      {(advanceEnabled || regressEnabled) && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#1D2235' }}>Pipeline de Produção</h2>
              <p style={{ fontSize: '13px', color: '#6B7494', margin: '4px 0 0 0' }}>
                Fase atual: <strong style={{ color: getFulfillmentInfo(order.fulfillmentStatus)?.color || '#1D2235' }}>{getFulfillmentInfo(order.fulfillmentStatus)?.label || order.fulfillmentStatus}</strong>
                {nextStageInfo && <> · próxima: {nextStageInfo.label}</>}
              </p>
              {order.currentStageNote && (
                <p style={{ fontSize: '13px', color: '#1D2235', backgroundColor: '#F0F5FB', padding: '8px 12px', borderRadius: '6px', margin: '8px 0 0 0', borderLeft: '3px solid #BBCFEB' }}>
                  <strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7494' }}>Nota da fase atual:</strong>
                  <br />{order.currentStageNote}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {regressEnabled && previousStageInfo && (
                <button
                  type="button"
                  onClick={handleRegressStage}
                  disabled={stageActionLoading}
                  style={{ padding: '12px 18px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: stageActionLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, color: '#6B7494', opacity: stageActionLoading ? 0.6 : 1 }}
                >
                  ← Voltar para {previousStageInfo.label}
                </button>
              )}
              {advanceEnabled && nextStageInfo && (
                <button
                  type="button"
                  onClick={() => { setAdvanceNote(''); setShowAdvanceModal(true) }}
                  disabled={stageActionLoading}
                  style={{ padding: '12px 22px', backgroundColor: '#1D2235', border: 'none', borderRadius: '8px', cursor: stageActionLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, color: 'white', opacity: stageActionLoading ? 0.6 : 1 }}
                >
                  Avançar para {nextStageInfo.label} →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="admin-order-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card title="Cliente">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><p style={{ fontSize: '14px', color: '#6B7494' }}>Nome</p><p style={{ fontWeight: 500 }}>{order.customerName}</p></div>
              <div><p style={{ fontSize: '14px', color: '#6B7494' }}>E-mail</p><p>{order.customerEmail}</p></div>
              <div><p style={{ fontSize: '14px', color: '#6B7494' }}>Telefone</p><p>{order.customerPhone}</p></div>
            </div>
          </Card>

          <Card title={stageOptions.deliveryMethod === 'pickup' ? 'Retirada no local' : 'Endereço de Entrega'}>
            {stageOptions.deliveryMethod === 'pickup' ? (
              <div style={{ lineHeight: 1.6 }}>
                <p style={{ margin: 0 }}>
                  <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', backgroundColor: '#DFF4EC', color: '#0E9F6E', fontWeight: 600, fontSize: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Retirada
                  </span>
                </p>
                <p style={{ marginTop: '12px', color: '#6B7494', fontSize: '13px' }}>
                  Cliente busca o pedido no local. Sem endereço de entrega cadastrado.
                </p>
              </div>
            ) : order.shippingAddress ? (
              <p style={{ lineHeight: 1.6 }}>
                {order.shippingAddress.street}, {order.shippingAddress.number}<br />
                {order.shippingAddress.complement && <>{order.shippingAddress.complement}<br /></>}
                {order.shippingAddress.neighborhood}<br />
                {order.shippingAddress.city} - {order.shippingAddress.state}<br />
                CEP: {order.shippingAddress.zipCode}
              </p>
            ) : (
              <p style={{ color: '#6B7494', fontSize: '13px' }}>Endereço não informado.</p>
            )}
          </Card>

          <Card title="Pagamento">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '14px', color: '#6B7494' }}>Status</p>
                <StatusBadge status={formData.paymentStatus} options={PAYMENT_STATUSES} />
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#6B7494' }}>Método</p>
                <p style={{ textTransform: 'capitalize' }}>{order.paymentMethod}</p>
              </div>
              {!isCancelled && (
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Atualizar pagamento</label>
                  <select value={formData.paymentStatus} onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px', backgroundColor: 'white' }}>
                    {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </Card>

          <Card title="Linha do Tempo">
            {timelineEntries.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6B7494', margin: 0 }}>
                —
                <br />
                <span style={{ fontSize: '12px' }}>Pedidos anteriores ao novo fluxo de pipeline não têm timeline registrada.</span>
              </p>
            ) : (
              <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {timelineEntries.map(entry => {
                  const info = getFulfillmentInfo(entry.status)
                  return (
                    <li key={entry.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '999px', backgroundColor: info?.color || '#6B7494', marginTop: '6px', flexShrink: 0 }} aria-hidden="true" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1D2235' }}>{entry.label}</div>
                        <div style={{ fontSize: '12px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>
                          {new Date(entry.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card title="Itens do Pedido">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {order.items.length === 0 ? (
                <p style={{ color: '#6B7494' }}>Nenhum item</p>
              ) : (
                order.items.map((item, idx) => {
                  const displayName = item.variantName
                    ? `${item.productName} · ${item.variantName}`
                    : item.productName
                  return (
                    <div key={idx} style={{ padding: '16px 0', borderBottom: idx < order.items.length - 1 ? '1px solid #D8DCE8' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontWeight: 500 }}>{displayName}</p>
                          <p style={{ fontSize: '14px', color: '#6B7494' }}>Qty: {item.quantity} × R$ {item.unitPrice.toFixed(2).replace('.', ',')}</p>
                        </div>
                        <p style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  )
                })
              )}
              <div style={{ padding: '16px 0', borderTop: '2px solid #D8DCE8', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#6B7494' }}><span>Subtotal</span><span style={{ fontFamily: 'var(--font-mono)' }}>R$ {order.subtotal.toFixed(2).replace('.', ',')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#6B7494' }}><span>Frete</span><span style={{ fontFamily: 'var(--font-mono)' }}>R$ {order.shippingCost.toFixed(2).replace('.', ',')}</span></div>
                {order.discountTotal && order.discountTotal > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#1D7A72' }}>
                    <span>Desconto{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-R$ {order.discountTotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}><span>Total</span><span style={{ fontFamily: 'var(--font-mono)' }}>R$ {order.total.toFixed(2).replace('.', ',')}</span></div>
              </div>
            </div>
          </Card>

          <OrderMaterialsCard orderId={order.id} />

          <Card title="Status & Logística">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Status do pedido (avançado)</label>
                <select value={formData.fulfillmentStatus} onChange={(e) => setFormData({ ...formData, fulfillmentStatus: e.target.value })} disabled={isCancelled} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px', backgroundColor: isCancelled ? '#F0F5FB' : 'white', color: isCancelled ? '#6B7494' : 'inherit' }}>
                  {FULFILLMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <p style={{ fontSize: '11px', color: '#6B7494', marginTop: '6px' }}>
                  Use os botões Avançar/Voltar acima para o fluxo padrão. Esta seleção é fallback manual e não registra nota nem timestamp do pipeline.
                </p>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                  Data prevista de entrega
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="datetime-local"
                    value={formData.expectedDeliveryAt}
                    onChange={(e) => setFormData({ ...formData, expectedDeliveryAt: e.target.value })}
                    disabled={isCancelled}
                    style={{ flex: 1, minWidth: '200px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px', backgroundColor: isCancelled ? '#F0F5FB' : 'white' }}
                  />
                  {formData.expectedDeliveryAt && !isCancelled && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, expectedDeliveryAt: '' })}
                      style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '6px' }}>
                  Útil para pedidos sob encomenda. Aparece pro cliente em &quot;Meus pedidos&quot;.
                </p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#6B7494', marginBottom: '8px' }}>Código de rastreamento</p>
                {order.trackingCode || formData.trackingCode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <code style={{ padding: '8px 12px', backgroundColor: '#F0F5FB', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{formData.trackingCode || order.trackingCode}</code>
                    <a href={`https://www.correios.com.br/rastreamento?n=${formData.trackingCode || order.trackingCode}`} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#3B82F6', color: 'white', borderRadius: '6px', fontSize: '13px', textDecoration: 'none' }}>Rastrear</a>
                  </div>
                ) : !isCancelled && (
                  <>
                    {showTrackingInput ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input type="text" value={formData.trackingCode} onChange={(e) => setFormData({ ...formData, trackingCode: e.target.value })} placeholder="Ex: PAC123456789BR" style={{ flex: 1, minWidth: '200px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '14px' }} />
                        <button onClick={() => setShowTrackingInput(false)} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowTrackingInput(true)} style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>+ Adicionar código de rastreamento</button>
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
            <button onClick={handleSendEmail} disabled={isCancelled} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: isCancelled ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isCancelled ? 0.5 : 1 }}>E-mail</button>
            <button onClick={handleSendWhatsApp} disabled={isCancelled} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#25D366', border: 'none', borderRadius: '8px', cursor: isCancelled ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isCancelled ? 0.5 : 1 }}>WhatsApp</button>
            <button onClick={handlePrintLabel} disabled={isCancelled} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: isCancelled ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isCancelled ? 0.5 : 1 }}>Etiqueta</button>
            {!isCancelled && (
              <button onClick={() => setShowCancelModal(true)} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Cancelar</button>
            )}
          </div>

          {!isCancelled && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button onClick={() => { setEditingItems(normalizeItems(order.items)); setVariantPickerFor(null); setShowEditItemsModal(true) }} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#3B82F6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Editar Itens</button>
              <button onClick={() => setShowCloneModal(true)} style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#8B5CF6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Clonar Pedido</button>
              {order.paymentStatus === 'paid' && (
                <button
                  onClick={() => { setRefundError(''); setShowRefundModal(true) }}
                  style={{ flex: 1, minWidth: '120px', padding: '12px 20px', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  Estornar pagamento
                </button>
              )}
            </div>
          )}

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #E3E9F4' }}>
            <p style={{ fontSize: '12px', color: '#6B7494', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Zona de perigo
            </p>
            <button
              onClick={() => { setDeleteConfirmInput(''); setShowDeleteModal(true) }}
              style={{ padding: '10px 18px', backgroundColor: 'white', border: '1px solid #B42318', borderRadius: '8px', cursor: 'pointer', color: '#B42318', fontWeight: 600, fontSize: '13px' }}
            >
              Excluir pedido permanentemente
            </button>
            <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '8px' }}>
              Diferente de cancelar — apaga o registro do banco. Use para pedidos de teste ou criados por engano. Pedidos pagos devem ser estornados antes.
            </p>
          </div>
        </div>
      </div>

      {showAdvanceModal && nextStageInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', maxWidth: '460px', width: '100%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#1D2235' }}>
              Avançar para {nextStageInfo.label}?
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7494', marginBottom: '16px' }}>
              Você pode adicionar uma nota interna sobre o que foi feito nesta fase. (Opcional — substitui qualquer nota anterior.)
            </p>
            <label htmlFor="stage-note" style={{ fontSize: '12px', fontWeight: 600, color: '#6B7494', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
              Nota da fase (opcional)
            </label>
            <textarea
              id="stage-note"
              value={advanceNote}
              onChange={(e) => setAdvanceNote(e.target.value)}
              rows={4}
              placeholder="Ex: arte aprovada pelo cliente, slicing concluído, etc."
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', marginBottom: '20px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={stageActionLoading}
                onClick={() => setShowAdvanceModal(false)}
                style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: stageActionLoading ? 'not-allowed' : 'pointer', fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={stageActionLoading}
                onClick={handleAdvanceStageConfirm}
                style={{ padding: '10px 22px', backgroundColor: '#1D2235', border: 'none', borderRadius: '8px', cursor: stageActionLoading ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 600, opacity: stageActionLoading ? 0.7 : 1 }}
              >
                {stageActionLoading ? 'Avançando...' : 'Confirmar avanço'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditItemsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Editar Itens do Pedido</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {editingItems.map((item) => {
                const key = itemKey(item.productId, item.variantId)
                const displayName = item.variantName
                  ? `${item.productName} · ${item.variantName}`
                  : item.productName
                return (
                  <div key={key} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', backgroundColor: '#F0F5FB', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 500 }}>{displayName}</p>
                      <p style={{ fontSize: '14px', color: '#6B7494' }}>R$ {item.unitPrice.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => handleUpdateQuantity(key, parseInt(e.target.value) || 1)} style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #D8DCE8' }} />
                    <button onClick={() => handleRemoveItem(key)} style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '6px', cursor: 'pointer', color: '#EF4444' }}>×</button>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', border: '1px solid #D8DCE8', borderRadius: '10px', padding: '12px' }}>
              {products.length > 0 ? (
                products.map(product => {
                  const hasVariants = product.variants && product.variants.length > 0
                  const isSelected = editingItems.some(item => item.productId === product.id)
                  const isPickerOpen = variantPickerFor === product.id
                  return (
                    <div key={product.id} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #D4849A' : isPickerOpen ? '2px solid #BBCFEB' : '1px solid #D8DCE8',
                          backgroundColor: isSelected ? '#D4849A12' : isPickerOpen ? '#F0F5FB' : 'white',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ display: 'block', fontWeight: 600 }}>{product.name}</span>
                        <span style={{ display: 'block', color: '#6B7494', fontSize: '13px', marginTop: '2px' }}>
                          {hasVariants
                            ? `${product.variants.length} variações`
                            : `R$ ${product.price.toFixed(2).replace('.', ',')} ${product.underOrder ? '· sob encomenda' : `· estoque ${product.stock ?? 'n/d'}`}`}
                        </span>
                        <span style={{ display: 'block', color: hasVariants ? '#BBCFEB' : '#D4849A', fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>
                          {hasVariants ? 'Escolher variação' : isSelected ? 'Adicionar mais uma unidade' : '+ Adicionar ao pedido'}
                        </span>
                      </button>
                      {isPickerOpen && (
                        <VariantPicker
                          product={product}
                          onSelect={(variant) => handleAddVariant(product, variant)}
                          onClose={() => setVariantPickerFor(null)}
                        />
                      )}
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: '16px', color: '#6B7494', textAlign: 'center', gridColumn: '1 / -1' }}>
                  Nenhum produto disponivel.
                </div>
              )}
            </div>
            <div style={{ padding: '16px', backgroundColor: '#F0F5FB', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Novo Total:</span><span>R$ {calculateNewTotal().toFixed(2).replace('.', ',')}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditItemsModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleEditItemsSave} style={{ padding: '10px 20px', backgroundColor: '#3B82F6', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}>Salvar Itens</button>
            </div>
          </div>
        </div>
      )}

      {showCloneModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Clonar Pedido?</h2>
            <p style={{ color: '#6B7494', marginBottom: '24px' }}>Esta ação ira criar um novo pedido com os mesmos dados.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCloneModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCloneOrder} style={{ padding: '10px 20px', backgroundColor: '#8B5CF6', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}>Sim, clonar</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Cancelar pedido?</h2>
            <p style={{ color: '#6B7494', marginBottom: '24px' }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCancelModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: 'pointer' }}>Manter pedido</button>
              <button onClick={handleCancelOrder} style={{ padding: '10px 20px', backgroundColor: '#EF4444', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}>Sim, cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '460px', width: '90%' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#B42318' }}>
              Excluir pedido permanentemente?
            </h2>
            <p style={{ color: '#6B7494', marginBottom: '8px' }}>
              Isso apaga o pedido <strong>{order.orderNumber}</strong> e todos os dados relacionados (itens, endereço, pagamento, tarefas de produção, logs).
            </p>
            <p style={{ color: '#6B7494', marginBottom: '20px', fontSize: '13px' }}>
              <strong>Não pode ser desfeito.</strong> Para confirmar, digite o número do pedido abaixo.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder={order.orderNumber}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', fontSize: '14px', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                Cancelar
              </button>
              <button
                disabled={deleting || deleteConfirmInput.trim() !== order.orderNumber}
                onClick={handleDeleteOrder}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#B42318',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleting || deleteConfirmInput.trim() !== order.orderNumber ? 'not-allowed' : 'pointer',
                  color: 'white',
                  fontWeight: 600,
                  opacity: deleting || deleteConfirmInput.trim() !== order.orderNumber ? 0.5 : 1,
                }}
              >
                {deleting ? 'Excluindo...' : 'Sim, excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '420px', width: '90%' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Estornar pagamento?</h2>
            <p style={{ color: '#6B7494', marginBottom: '8px' }}>
              O Mercado Pago vai devolver <strong>R$ {order.total.toFixed(2).replace('.', ',')}</strong> para o cliente.
            </p>
            <p style={{ color: '#6B7494', marginBottom: '20px', fontSize: '13px' }}>
              Esta ação não pode ser desfeita pelo painel. O pedido será marcado como estornado.
            </p>
            {refundError && (
              <p role="alert" style={{ color: '#B42318', background: '#FEE2E2', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px' }}>{refundError}</p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                disabled={refunding}
                onClick={() => setShowRefundModal(false)}
                style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #D8DCE8', borderRadius: '8px', cursor: refunding ? 'not-allowed' : 'pointer' }}
              >
                Cancelar
              </button>
              <button
                disabled={refunding}
                onClick={handleRefundOrder}
                style={{ padding: '10px 20px', backgroundColor: '#F59E0B', border: 'none', borderRadius: '8px', cursor: refunding ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 500, opacity: refunding ? 0.7 : 1 }}
              >
                {refunding ? 'Estornando...' : 'Sim, estornar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
