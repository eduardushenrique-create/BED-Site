import 'server-only'

import { Resend } from 'resend'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import {
  getLowStockRecipients,
  getOrderAlertRecipients,
  type SerializedComponent,
} from '@/lib/components-stock'
import { getResolvedTemplate, renderTemplate } from '@/lib/email-templates'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'stock-alerts' })

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'BED Design <noreply@beddesigns.com.br>'
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || 'eduardus.henrique@gmail.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

/** Throttle: não mais de 1 alerta por componente por 6h. */
const LOW_STOCK_THROTTLE_HOURS = 6

function formatNumber(n: number, unit: string): string {
  const decimals = ['kg', 'g', 'L', 'ml', 'm'].includes(unit) ? 3 : 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

/**
 * Envia alerta de estoque baixo PARA UM componente. Idempotente via
 * tabela LowStockAlertLog (PK = componentId): se já houve alerta nas
 * últimas 6h, no-op.
 *
 * Roda em background — `void` no chamador, não bloqueia.
 */
export async function sendLowStockAlertIfDue(componentId: string): Promise<{ sent: boolean; reason?: string }> {
  if (!hasDatabase || !prisma?.component) return { sent: false, reason: 'no_database' }
  if (!resend) return { sent: false, reason: 'resend_not_configured' }

  try {
    const component = await prisma.component.findUnique({ where: { id: componentId } })
    if (!component) return { sent: false, reason: 'not_found' }
    if (!component.isActive) return { sent: false, reason: 'inactive' }

    const threshold =
      component.lowStockThreshold === null
        ? null
        : Number(component.lowStockThreshold.toString())
    if (threshold === null) return { sent: false, reason: 'no_threshold' }

    const stock = Number(component.stock.toString())
    if (stock > threshold) return { sent: false, reason: 'above_threshold' }

    // Throttle por componente.
    const lastLog = await prisma.lowStockAlertLog.findUnique({ where: { componentId } })
    if (lastLog) {
      const ageHours = (Date.now() - lastLog.lastSentAt.getTime()) / (1000 * 60 * 60)
      if (ageHours < LOW_STOCK_THROTTLE_HOURS) {
        return { sent: false, reason: `throttled:${ageHours.toFixed(1)}h` }
      }
    }

    const recipients = await getLowStockRecipients()
    if (recipients.length === 0) {
      return { sent: false, reason: 'no_recipients' }
    }

    const template = await getResolvedTemplate('low_stock_alert')
    const restockUrl = APP_URL ? `${APP_URL.replace(/\/$/, '')}/admin/componentes/${componentId}` : ''
    const rendered = renderTemplate(template, {
      componentName: component.name,
      componentSku: component.sku ? ` (${component.sku})` : '',
      currentStock: formatNumber(stock, component.unit),
      unit: component.unit,
      threshold: formatNumber(threshold, component.unit),
      restockUrl,
      supplierUrl: component.supplierUrl || restockUrl,
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      ...(rendered.text ? { text: rendered.text } : {}),
    })

    await prisma.lowStockAlertLog.upsert({
      where: { componentId },
      update: { lastSentAt: new Date(), lastBalance: stock },
      create: { componentId, lastSentAt: new Date(), lastBalance: stock },
    })

    log.info({ componentId, stock, threshold, recipients: recipients.length }, 'low stock alert sent')
    return { sent: true }
  } catch (error) {
    captureException(error, { context: 'stock-alerts', detail: 'sendLowStockAlertIfDue failed', componentId })
    return { sent: false, reason: 'error' }
  }
}

/** Dispara em background — caller não espera. */
export function fireLowStockAlertInBackground(componentId: string): void {
  void sendLowStockAlertIfDue(componentId).catch(error => {
    captureException(error, { context: 'stock-alerts', detail: 'background low stock crashed', componentId })
  })
}

// ---------------------------------------------------------------------------
// Alerta proativo: pedido entra precisando de componente em falta
// ---------------------------------------------------------------------------

export interface OrderShortageItem {
  componentName: string
  componentSku: string | null
  required: number
  inStock: number
  shortage: number
  unit: string
}

export interface OrderShortageContext {
  orderNumber: string
  customerName: string
  orderId: string
  shortages: OrderShortageItem[]
}

export async function sendOrderShortageAlert(ctx: OrderShortageContext): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) return { sent: false, reason: 'resend_not_configured' }
  if (ctx.shortages.length === 0) return { sent: false, reason: 'no_shortages' }

  try {
    const recipients = await getOrderAlertRecipients()
    if (recipients.length === 0) return { sent: false, reason: 'no_recipients' }

    const template = await getResolvedTemplate('order_component_shortage')
    const orderUrl = APP_URL ? `${APP_URL.replace(/\/$/, '')}/admin/pedidos/${ctx.orderId}` : ''
    const shortagesHtml = ctx.shortages
      .map(s => {
        const skuLine = s.componentSku ? ` <span style="color:#6B7494;font-size:12px;">(${s.componentSku})</span>` : ''
        return `<li><strong>${escapeHtml(s.componentName)}</strong>${skuLine}: faltam ${formatNumber(s.shortage, s.unit)} ${s.unit} (precisa ${formatNumber(s.required, s.unit)}, em estoque ${formatNumber(s.inStock, s.unit)})</li>`
      })
      .join('\n')

    const rendered = renderTemplate(
      template,
      {
        orderNumber: ctx.orderNumber,
        customerName: ctx.customerName,
        orderUrl,
      },
      { shortagesHtml },
    )

    await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      ...(rendered.text ? { text: rendered.text } : {}),
    })

    log.info({ orderNumber: ctx.orderNumber, shortageCount: ctx.shortages.length, recipients: recipients.length }, 'order shortage alert sent')
    return { sent: true }
  } catch (error) {
    captureException(error, { context: 'stock-alerts', detail: 'sendOrderShortageAlert failed', orderNumber: ctx.orderNumber })
    return { sent: false, reason: 'error' }
  }
}

export function fireOrderShortageAlertInBackground(ctx: OrderShortageContext): void {
  void sendOrderShortageAlert(ctx).catch(error => {
    captureException(error, { context: 'stock-alerts', detail: 'background order shortage crashed', orderNumber: ctx.orderNumber })
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function checkOrderShortages(orderId: string): Promise<OrderShortageItem[]> {
  if (!hasDatabase || !prisma?.order) return []
  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      include: { items: { select: { productId: true, variantId: true, quantity: true } } },
    })
    if (!order) return []

    const aggregate = new Map<string, OrderShortageItem & { componentId: string }>()

    for (const item of order.items) {
      // SPEC-007 §3.3.1: itens custom (productId=null) não têm BOM no catálogo.
      if (!item.productId) continue
      const bom = await prisma.productComponent.findMany({
        where: {
          productId: item.productId,
          OR: [{ variantId: null }, ...(item.variantId ? [{ variantId: item.variantId }] : [])],
        },
        include: { component: true },
      })
      for (const row of bom) {
        const qpu = Number(row.quantityPerUnit.toString())
        if (qpu <= 0) continue
        const required = qpu * item.quantity
        const existing = aggregate.get(row.componentId)
        if (existing) {
          existing.required += required
        } else {
          aggregate.set(row.componentId, {
            componentId: row.componentId,
            componentName: row.component.name,
            componentSku: row.component.sku,
            required,
            inStock: Number(row.component.stock.toString()),
            shortage: 0,
            unit: row.component.unit,
          })
        }
      }
    }

    return Array.from(aggregate.values())
      .map(r => ({ ...r, shortage: Math.max(0, r.required - r.inStock) }))
      .filter(r => r.shortage > 0)
  } catch (error) {
    captureException(error, { context: 'stock-alerts', detail: 'checkOrderShortages failed', orderId })
    return []
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Re-export tipos pra outras partes do código não importarem direto
export type { SerializedComponent }
