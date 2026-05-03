import { Resend } from 'resend'
import { getResolvedTemplate, renderTemplate, type EmailTemplateSlug } from '@/lib/email-templates'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Domain verified at Resend on 2026-05-02. Stakeholder can override via env
// without a redeploy if they later set up a Google Workspace / Zoho mailbox.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'BED Design <noreply@beddesigns.com.br>'
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || 'eduardus.henrique@gmail.com'

interface OrderEmailData {
  orderNumber: string
  customerName: string
  customerEmail: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  total: number
  shippingAddress?: {
    street: string
    number: string
    city: string
    state: string
  }
}

function firstName(full: string | null | undefined): string {
  if (!full) return ''
  return full.trim().split(/\s+/)[0] || ''
}

function moneyBR(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

/**
 * Wrapper único de envio. Resolve o template (override no banco ou default
 * hardcoded), renderiza com variáveis, e despacha pelo Resend. Loga e devolve
 * `false` em qualquer erro — chamadores existentes não esperam exceção.
 */
async function sendTemplate(args: {
  slug: EmailTemplateSlug
  to: string
  variables: Record<string, string | number>
  rawVariables?: Record<string, string>
  /** Quando Resend não está configurado, esse callback roda em dev pra logar info útil. */
  devFallback?: () => void
}): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV !== 'production' && args.devFallback) {
      args.devFallback()
    }
    return true
  }

  try {
    const template = await getResolvedTemplate(args.slug)
    const rendered = renderTemplate(template, args.variables, args.rawVariables || {})
    await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: args.to,
      subject: rendered.subject,
      html: rendered.html,
      ...(rendered.text ? { text: rendered.text } : {}),
    })
    return true
  } catch (error) {
    console.error(`Error sending email [${args.slug}]:`, error)
    return false
  }
}

export async function sendOrderConfirmation(data: OrderEmailData): Promise<boolean> {
  const itemsHtml = data.items
    .map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #E8E2DA;">
          ${escapeHtml(item.name)}
          <br><span style="color: #78716C; font-size: 14px;">Quantidade: ${item.quantity}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #E8E2DA; text-align: right;">
          R$ ${moneyBR(item.price)}
        </td>
      </tr>
    `)
    .join('')

  return sendTemplate({
    slug: 'order_confirmation',
    to: data.customerEmail,
    variables: {
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      total: moneyBR(data.total),
    },
    rawVariables: { itemsHtml },
  })
}

export async function sendAccessCodeEmail(email: string, code: string): Promise<boolean> {
  return sendTemplate({
    slug: 'access_code',
    to: email,
    variables: { code },
    devFallback: () => console.info(`[auth] Código de acesso para ${email}: ${code}`),
  })
}

export async function sendPaymentApproved(data: OrderEmailData): Promise<boolean> {
  return sendTemplate({
    slug: 'payment_approved',
    to: data.customerEmail,
    variables: {
      orderNumber: data.orderNumber,
      customerName: data.customerName,
    },
  })
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
): Promise<boolean> {
  return sendTemplate({
    slug: 'password_reset',
    to: email,
    variables: {
      customerFirstName: firstName(name),
      resetUrl,
    },
    devFallback: () => console.info(`[auth] Link de redefinição de senha para ${email}: ${resetUrl}`),
  })
}

export async function sendOrderInProduction(
  email: string,
  customerName: string,
  orderNumber: string,
): Promise<boolean> {
  return sendTemplate({
    slug: 'order_in_production',
    to: email,
    variables: {
      orderNumber,
      customerFirstName: firstName(customerName),
    },
  })
}

export async function sendOrderRefunded(
  email: string,
  customerName: string,
  orderNumber: string,
  amount: number,
): Promise<boolean> {
  return sendTemplate({
    slug: 'order_refunded',
    to: email,
    variables: {
      orderNumber,
      customerFirstName: firstName(customerName),
      amount: moneyBR(amount),
    },
  })
}

export async function sendOrderDelivered(
  email: string,
  orderNumber: string,
): Promise<boolean> {
  return sendTemplate({
    slug: 'order_delivered',
    to: email,
    variables: { orderNumber },
  })
}

export async function sendRestockAlertEmail(
  email: string,
  productName: string,
  productSlug: string,
  appUrl: string,
): Promise<boolean> {
  const productUrl = `${appUrl.replace(/\/$/, '')}/produtos/${productSlug}`
  return sendTemplate({
    slug: 'restock_alert',
    to: email,
    variables: { productName, productUrl },
    devFallback: () => console.info(`[restock] ${productName} disponível para ${email}`),
  })
}

export async function sendOrderShipped(
  email: string,
  orderNumber: string,
  trackingCode: string,
): Promise<boolean> {
  return sendTemplate({
    slug: 'order_shipped',
    to: email,
    variables: { orderNumber, trackingCode },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
