import 'server-only'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { hasDatabase, DatabaseUnavailableError } from '@/lib/database'

/**
 * SPEC-007 §3.3 — criacao de pedido manual (createdVia='admin').
 *
 * Difere de `createOrder` em lib/database.ts:
 *   - Suporta items 'custom' (sem productId, sem product no catalogo).
 *   - Pega `manualChannel`, `referredBy`, `internalNotes`, `createdByEmail`.
 *   - NAO cria registro Payment (pedido manual usa PaymentInstallment).
 *   - Pode ser disparado por /api/admin/orders ou por
 *     /api/orcamentos/[id]/converter-pedido (este passa `estimateId` em
 *     pelo menos 1 item).
 *
 * Fluxo:
 *   1. Valida itens (catalog precisa de productId; custom precisa de
 *      productNameSnapshot + unitPrice).
 *   2. Para itens catalog: busca Product, copia productNameSnapshot/skuSnapshot,
 *      compara unitPriceOverride com Product.price -> calcula priceOverridden.
 *   3. Calcula subtotal/total no SERVIDOR (nunca confia no client).
 *   4. Em transacao: cria Order + OrderItems. Se algum item tem estimateId,
 *      marca PricingEstimate como converted no fim da transacao.
 *
 * Em prod sem DB: lanca DatabaseUnavailableError (mesmo padrao SPEC-005).
 */

const FAIL_FAST_IN_PRODUCTION =
  process.env.NODE_ENV === 'production' && Boolean(process.env.DATABASE_URL)

const VALID_MANUAL_CHANNELS = new Set([
  'whatsapp',
  'instagram',
  'indicacao',
  'presencial',
  'telefone',
  'outro',
])
const VALID_PAYMENT_STATUS = new Set(['pending', 'partial', 'paid'])
const VALID_FULFILLMENT_STATUS = new Set([
  'pending',
  'aguardando_producao',
])
const VALID_DELIVERY = new Set(['shipping', 'pickup'])
const VALID_ORDER_TYPE = new Set(['sob_encomenda', 'pronta_entrega'])

export type ManualOrderItemInput =
  | {
      itemType: 'catalog'
      productId: string
      variantId?: string | null
      quantity: number
      unitPriceOverride?: number | null
      personalizationJson?: any
      productionNotesItem?: string | null
      estimateId?: string | null
    }
  | {
      itemType: 'custom'
      productNameSnapshot: string
      skuSnapshot?: string | null
      description?: string | null
      quantity: number
      unitPrice: number
      personalizationJson?: any
      productionNotesItem?: string | null
      estimateId?: string | null
    }

export type ManualOrderInput = {
  manualChannel: string
  referredBy?: string | null
  customer: {
    customerId?: string | null
    name: string
    email?: string | null
    phone?: string | null
    cpf?: string | null
  }
  items: ManualOrderItemInput[]
  discountTotal?: number
  discountReason?: string | null
  shippingTotal?: number
  shippingMethod?: string | null
  deliveryMethod?: 'shipping' | 'pickup'
  orderType?: 'sob_encomenda' | 'pronta_entrega'
  paymentStatus?: 'pending' | 'partial' | 'paid'
  fulfillmentStatus?: 'pending' | 'aguardando_producao'
  productionDeadline?: string | null
  expectedDeliveryAt?: string | null
  internalNotes?: string | null
  notes?: string | null
  createdByEmail?: string | null
}

export class ManualOrderValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManualOrderValidationError'
  }
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type ManualOrderResult = {
  id: string
  orderNumber: string
  total: number
  subtotal: number
  paymentStatus: string
  fulfillmentStatus: string
  itemCount: number
}

/**
 * Cria um pedido manual seguindo SPEC-007 §3.3.
 * Lanca ManualOrderValidationError em problemas de validacao do payload
 * (handler converte em 400). Outros erros sobem.
 */
export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  if (!hasDatabase || !(prisma as any)?.order) {
    if (FAIL_FAST_IN_PRODUCTION) {
      throw new DatabaseUnavailableError(
        'Pedido nao pode ser registrado: banco de dados indisponivel.',
      )
    }
    throw new ManualOrderValidationError('Banco de dados indisponivel')
  }

  // 1. Validacoes basicas
  if (!input.manualChannel || !VALID_MANUAL_CHANNELS.has(input.manualChannel)) {
    throw new ManualOrderValidationError(
      `manualChannel invalido. Use um de: ${Array.from(VALID_MANUAL_CHANNELS).join(', ')}`,
    )
  }
  if (!input.customer?.name) {
    throw new ManualOrderValidationError('customer.name eh obrigatorio')
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ManualOrderValidationError('Informe ao menos 1 item')
  }
  if (input.paymentStatus && !VALID_PAYMENT_STATUS.has(input.paymentStatus)) {
    throw new ManualOrderValidationError('paymentStatus invalido')
  }
  if (input.fulfillmentStatus && !VALID_FULFILLMENT_STATUS.has(input.fulfillmentStatus)) {
    throw new ManualOrderValidationError('fulfillmentStatus invalido')
  }
  if (input.deliveryMethod && !VALID_DELIVERY.has(input.deliveryMethod)) {
    throw new ManualOrderValidationError('deliveryMethod invalido')
  }
  if (input.orderType && !VALID_ORDER_TYPE.has(input.orderType)) {
    throw new ManualOrderValidationError('orderType invalido')
  }

  // 2. Resolve produtos do catalogo (uma query so) e valida items
  type PrepItem = {
    itemType: 'catalog' | 'custom'
    productId: string | null
    variantId: string | null
    productNameSnapshot: string
    skuSnapshot: string | null
    description: string | null
    quantity: number
    unitPrice: number
    total: number
    priceOverridden: boolean
    personalizationJson: string | null
    productionNotesItem: string | null
    estimateId: string | null
  }

  const catalogProductIds = input.items
    .filter((i): i is Extract<ManualOrderItemInput, { itemType: 'catalog' }> => i.itemType === 'catalog')
    .map(i => i.productId)
  const products =
    catalogProductIds.length > 0
      ? await (prisma as any).product.findMany({
          where: { id: { in: catalogProductIds } },
          include: { variants: true },
        })
      : []
  const productById = new Map<string, any>(products.map((p: any) => [p.id, p]))

  const prepItems: PrepItem[] = input.items.map((raw, idx) => {
    if (raw.itemType === 'catalog') {
      if (!raw.productId) {
        throw new ManualOrderValidationError(`Item [${idx}] catalog precisa de productId`)
      }
      const product = productById.get(raw.productId)
      if (!product) {
        throw new ManualOrderValidationError(`Item [${idx}] productId inexistente`)
      }
      if (product.variants.length > 0 && !raw.variantId) {
        throw new ManualOrderValidationError(
          `Item [${idx}]: produto "${product.name}" tem variantes — selecione uma`,
        )
      }
      const variant = raw.variantId
        ? product.variants.find((v: any) => v.id === raw.variantId)
        : null
      if (raw.variantId && !variant) {
        throw new ManualOrderValidationError(`Item [${idx}]: variantId invalido`)
      }
      if (!Number.isFinite(raw.quantity) || raw.quantity < 1) {
        throw new ManualOrderValidationError(`Item [${idx}]: quantity deve ser >= 1`)
      }
      const catalogPrice = Number(product.price)
      const unitPrice =
        raw.unitPriceOverride != null && Number.isFinite(raw.unitPriceOverride)
          ? Number(raw.unitPriceOverride)
          : catalogPrice
      if (unitPrice < 0) {
        throw new ManualOrderValidationError(`Item [${idx}]: unitPrice negativo`)
      }
      const priceOverridden =
        raw.unitPriceOverride != null && Math.abs(unitPrice - catalogPrice) > 0.001
      return {
        itemType: 'catalog',
        productId: product.id,
        variantId: variant?.id ?? null,
        productNameSnapshot: product.name,
        skuSnapshot: variant?.sku ?? product.sku ?? null,
        description: null,
        quantity: raw.quantity,
        unitPrice: round2(unitPrice),
        total: round2(unitPrice * raw.quantity),
        priceOverridden,
        personalizationJson:
          raw.personalizationJson != null ? JSON.stringify(raw.personalizationJson) : null,
        productionNotesItem: raw.productionNotesItem ?? null,
        estimateId: raw.estimateId ?? null,
      }
    } else {
      // custom
      if (!raw.productNameSnapshot) {
        throw new ManualOrderValidationError(`Item [${idx}] custom precisa de productNameSnapshot`)
      }
      if (!Number.isFinite(raw.quantity) || raw.quantity < 1) {
        throw new ManualOrderValidationError(`Item [${idx}]: quantity deve ser >= 1`)
      }
      if (!Number.isFinite(raw.unitPrice) || raw.unitPrice < 0) {
        throw new ManualOrderValidationError(`Item [${idx}] custom precisa de unitPrice >= 0`)
      }
      return {
        itemType: 'custom',
        productId: null,
        variantId: null,
        productNameSnapshot: raw.productNameSnapshot,
        skuSnapshot: raw.skuSnapshot ?? null,
        description: raw.description ?? null,
        quantity: raw.quantity,
        unitPrice: round2(raw.unitPrice),
        total: round2(raw.unitPrice * raw.quantity),
        priceOverridden: false,
        personalizationJson:
          raw.personalizationJson != null ? JSON.stringify(raw.personalizationJson) : null,
        productionNotesItem: raw.productionNotesItem ?? null,
        estimateId: raw.estimateId ?? null,
      }
    }
  })

  // 3. Totais (no servidor!)
  const subtotal = round2(prepItems.reduce((s, i) => s + i.total, 0))
  const discountTotal = round2(Math.max(0, Number(input.discountTotal ?? 0)))
  const shippingTotal = round2(Math.max(0, Number(input.shippingTotal ?? 0)))
  const total = round2(Math.max(0, subtotal + shippingTotal - discountTotal))

  // 4. Defaults derivados
  const paymentStatus = input.paymentStatus ?? 'pending'
  const fulfillmentStatus = input.fulfillmentStatus ?? 'pending'
  const deliveryMethod = input.deliveryMethod ?? 'shipping'

  // Sem productId em item custom -> orderType seguro = sob_encomenda
  const hasCustom = prepItems.some(i => i.itemType === 'custom')
  const orderType = input.orderType ?? (hasCustom ? 'sob_encomenda' : 'sob_encomenda')

  // Backfill paid/dueAmount (igual createOrder em lib/database.ts)
  const paidAmount = paymentStatus === 'paid' ? total : 0
  const dueAmount = round2(Math.max(0, total - paidAmount))

  const dec = (n: number) => new Prisma.Decimal(n)

  // 5. Transacao: cria Order + Items + atualiza estimates (se houver)
  const estimateIds = Array.from(
    new Set(prepItems.map(i => i.estimateId).filter((v): v is string => !!v)),
  )

  const order = await (prisma as any).$transaction(async (tx: any) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName: input.customer.name,
        customerEmail: input.customer.email ?? '',
        customerPhone: input.customer.phone ?? null,
        customerCpf: input.customer.cpf ?? null,
        customerId: input.customer.customerId ?? null,
        subtotal: dec(subtotal),
        discountTotal: dec(discountTotal),
        discountReason: input.discountReason ?? null,
        shippingTotal: dec(shippingTotal),
        total: dec(total),
        shippingMethod: input.shippingMethod ?? null,
        productionDeadline: input.productionDeadline ? new Date(input.productionDeadline) : null,
        expectedDeliveryAt: input.expectedDeliveryAt ? new Date(input.expectedDeliveryAt) : null,
        status: 'pending',
        paymentStatus,
        fulfillmentStatus,
        deliveryMethod,
        orderType,
        createdVia: 'admin',
        manualChannel: input.manualChannel,
        referredBy: input.referredBy ?? null,
        internalNotes: input.internalNotes ?? null,
        createdByEmail: input.createdByEmail ?? null,
        paidAmount: dec(paidAmount),
        dueAmount: dec(dueAmount),
        items: {
          create: prepItems.map(i => ({
            productId: i.productId,
            variantId: i.variantId,
            productNameSnapshot: i.productNameSnapshot,
            skuSnapshot: i.skuSnapshot,
            quantity: i.quantity,
            unitPrice: dec(i.unitPrice),
            total: dec(i.total),
            personalizationJson: i.personalizationJson,
            itemType: i.itemType,
            description: i.description,
            productionNotesItem: i.productionNotesItem,
            priceOverridden: i.priceOverridden,
            estimateId: i.estimateId,
          })),
        },
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        subtotal: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        items: { select: { id: true } },
      },
    })

    // Marca estimates como converted
    if (estimateIds.length > 0) {
      await tx.pricingEstimate.updateMany({
        where: { id: { in: estimateIds }, status: { not: 'converted' } },
        data: {
          status: 'converted',
          convertedToOrderId: newOrder.id,
          convertedAt: new Date(),
        },
      })
    }

    return newOrder
  })

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    itemCount: order.items.length,
  }
}
