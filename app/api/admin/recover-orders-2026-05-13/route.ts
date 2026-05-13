import { NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Endpoint TEMPORÁRIO para recuperar os 4 pedidos perdidos no fallback
 * localDb durante o incidente de 2026-05-13. Os dados foram extraídos
 * via GET /api/pedidos (que estava lendo do JSON local) antes do
 * container Docker ser descartado.
 *
 * Substitui o SQL manual (docs/recover-orders-2026-05-13.sql) porque
 * o console SQL do Railway estava silenciosamente descartando
 * transações multi-statement, frustrando o recovery manual.
 *
 * Após o recovery confirmado, remover este arquivo num PR de cleanup.
 *
 * Idempotente: se um pedido já existe (orderNumber unique), pula.
 * Cada pedido em transação separada — falha em um não derruba os outros.
 */

type RecoveryItem = {
  id: string
  productId: string
  productNameSnapshot: string
  quantity: number
  unitPrice: number
  total: number
  personalizationJson: string | null
}

type RecoveryAddress = {
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
}

type RecoveryPayload = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  subtotal: number
  discountTotal: number
  discountReason: string | null
  shippingTotal: number
  total: number
  deliveryMethod: 'pickup' | 'shipping'
  orderType: 'sob_encomenda' | 'pronta_entrega'
  productionTimeline: Record<string, string | null> | null
  createdAt: string
  items: RecoveryItem[]
  address: RecoveryAddress | null
  payment: {
    id: string
    amount: number
    rawPayload: Record<string, unknown>
  }
}

const ORDERS_TO_RECOVER: RecoveryPayload[] = [
  {
    id: 'order_1778681117391',
    orderNumber: 'BD-MP44SI4A',
    customerName: 'Gisele (mãe Isis)',
    customerEmail: 'gisele@maeisis.com',
    customerPhone: '',
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'aguardando_pagamento',
    subtotal: 99,
    discountTotal: 99,
    discountReason: 'Presente',
    shippingTotal: 0,
    total: 0,
    deliveryMethod: 'pickup',
    orderType: 'sob_encomenda',
    productionTimeline: {
      confirmado_at: '2026-05-13T14:05:31.455Z',
      aguardando_pagamento_at: '2026-05-13T14:14:40.790Z',
      ready_to_pickup_at: '2026-05-13T14:14:28.818Z',
    },
    createdAt: '2026-05-13T14:04:41.530Z',
    address: null,
    items: [
      {
        id: 'oi_1778681117391_1',
        productId: 'cmovgk0d1000f01mu6ywmjq5j',
        productNameSnapshot: 'Personalizados em Geral',
        quantity: 1,
        unitPrice: 99,
        total: 99,
        personalizationJson: 'Presente Isis',
      },
    ],
    payment: {
      id: 'pmt_1778681117391',
      amount: 0,
      rawPayload: {
        discountKind: 'percentage',
        discountInput: 100,
        discountReason: 'Presente',
        discountAppliedBy: 'beddesings@gmail.com',
        appliedAt: '2026-05-13T14:04:41.530Z',
        recoveredFromLocalDb: true,
      },
    },
  },
  {
    id: 'order_1778680851328',
    orderNumber: 'BD-MP44MSTM',
    customerName: 'Cecília (Mãe Diogo)',
    customerEmail: 'cecilia@diogo.com',
    customerPhone: '',
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'aguardando_pagamento',
    subtotal: 35,
    discountTotal: 5,
    discountReason: null,
    shippingTotal: 0,
    total: 30,
    deliveryMethod: 'shipping',
    orderType: 'sob_encomenda',
    productionTimeline: null,
    createdAt: '2026-05-13T14:00:15.466Z',
    // Endereço veio com TODOS os campos vazios no JSON original. Preservar
    // string vazia satisfaz NOT NULL e marca o pedido como "endereço pendente
    // — admin precisa preencher antes de avançar para envio".
    address: {
      zipCode: '',
      street: '',
      number: '',
      complement: null,
      neighborhood: '',
      city: '',
      state: '',
    },
    items: [
      {
        id: 'oi_1778680851328_1',
        productId: 'cmos1svsr00081yr0qg769h00',
        productNameSnapshot: 'PORTA FIGURINHAS - SINGLE (PERSONALIZAVEL)',
        quantity: 1,
        unitPrice: 35,
        total: 35,
        personalizationJson: 'Rosa',
      },
    ],
    payment: {
      id: 'pmt_1778680851328',
      amount: 30,
      rawPayload: {
        discountKind: 'fixed',
        discountInput: 5,
        discountReason: null,
        discountAppliedBy: 'beddesings@gmail.com',
        appliedAt: '2026-05-13T14:00:15.466Z',
        recoveredFromLocalDb: true,
      },
    },
  },
  {
    id: 'order_1778680811362',
    orderNumber: 'BD-MP44LXYQ',
    customerName: 'Jéssica Mercado Livre',
    customerEmail: 'jessica@mercadolivre.com',
    customerPhone: '11 95288-2887',
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'aguardando_pagamento',
    subtotal: 990,
    discountTotal: 297,
    discountReason: 'Venda Atacado',
    shippingTotal: 0,
    total: 693,
    deliveryMethod: 'pickup',
    orderType: 'sob_encomenda',
    productionTimeline: null,
    createdAt: '2026-05-13T13:59:35.474Z',
    address: null,
    items: [
      {
        id: 'oi_1778680811362_1',
        productId: 'cmos1p20400051yr0c7tc4urm',
        productNameSnapshot: 'PORTA FIGURINHAS - SINGLE',
        quantity: 33,
        unitPrice: 30,
        total: 990,
        personalizationJson: '11 de cada cor - Branco com Preto, Azul com Dourado e Verde com Dourado',
      },
    ],
    payment: {
      id: 'pmt_1778680811362',
      amount: 693,
      rawPayload: {
        discountKind: 'fixed',
        discountInput: 297,
        discountReason: 'Venda Atacado',
        discountAppliedBy: 'beddesings@gmail.com',
        appliedAt: '2026-05-13T13:59:35.474Z',
        recoveredFromLocalDb: true,
      },
    },
  },
  {
    id: 'order_1778680402139',
    orderNumber: 'BD-MP44D664',
    customerName: 'Letícia Vizinha (mãe Isaque)',
    customerEmail: 'leticia@vizinha.com',
    customerPhone: '',
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'aguardando_pagamento',
    subtotal: 99,
    discountTotal: 0,
    discountReason: null,
    shippingTotal: 0,
    total: 99,
    deliveryMethod: 'pickup',
    orderType: 'sob_encomenda',
    productionTimeline: {
      confirmado_at: '2026-05-13T13:53:49.972Z',
      aguardando_pagamento_at: '2026-05-13T13:53:53.160Z',
    },
    createdAt: '2026-05-13T13:52:46.204Z',
    address: null,
    items: [
      {
        id: 'oi_1778680402139_1',
        productId: 'cmovgk0d1000f01mu6ywmjq5j',
        productNameSnapshot: 'Personalizados em Geral',
        quantity: 1,
        unitPrice: 99,
        total: 99,
        personalizationJson: 'Kit Forma massinha (carros - 4)',
      },
    ],
    payment: {
      id: 'pmt_1778680402139',
      amount: 99,
      rawPayload: {
        recoveredFromLocalDb: true,
        appliedAt: '2026-05-13T13:52:46.204Z',
      },
    },
  },
]

async function recoverOne(payload: RecoveryPayload) {
  if (!prisma?.order) {
    return { orderNumber: payload.orderNumber, status: 'error', error: 'prisma indisponível' }
  }

  const existing = await prisma.order.findUnique({
    where: { orderNumber: payload.orderNumber },
    select: { id: true },
  })
  if (existing) {
    return { orderNumber: payload.orderNumber, status: 'already_exists', id: existing.id }
  }

  try {
    const created = await prisma.$transaction(async tx => {
      const order = await tx.order.create({
        data: {
          id: payload.id,
          orderNumber: payload.orderNumber,
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          customerPhone: payload.customerPhone,
          status: payload.status,
          paymentStatus: payload.paymentStatus,
          fulfillmentStatus: payload.fulfillmentStatus,
          subtotal: payload.subtotal,
          discountTotal: payload.discountTotal,
          discountReason: payload.discountReason,
          shippingTotal: payload.shippingTotal,
          total: payload.total,
          deliveryMethod: payload.deliveryMethod,
          orderType: payload.orderType,
          productionTimeline: payload.productionTimeline ?? undefined,
          createdAt: new Date(payload.createdAt),
        },
      })

      if (payload.items.length > 0) {
        await tx.orderItem.createMany({
          data: payload.items.map(item => ({
            id: item.id,
            orderId: order.id,
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            personalizationJson: item.personalizationJson,
          })),
        })
      }

      if (payload.address) {
        await tx.address.create({
          data: {
            id: `addr_${payload.id.replace('order_', '')}`,
            orderId: order.id,
            zipCode: payload.address.zipCode,
            street: payload.address.street,
            number: payload.address.number,
            complement: payload.address.complement,
            neighborhood: payload.address.neighborhood,
            city: payload.address.city,
            state: payload.address.state,
          },
        })
      }

      await tx.payment.create({
        data: {
          id: payload.payment.id,
          orderId: order.id,
          provider: 'manual',
          method: 'manual',
          status: 'pending',
          amount: payload.payment.amount,
          rawPayload: payload.payment.rawPayload as never,
        },
      })

      return order
    })

    return { orderNumber: payload.orderNumber, status: 'created', id: created.id }
  } catch (error) {
    return {
      orderNumber: payload.orderNumber,
      status: 'error',
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
  }
}

export async function POST() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!prisma?.order) {
    return NextResponse.json(
      { error: 'Prisma client indisponível' },
      { status: 503 },
    )
  }

  const results = []
  for (const payload of ORDERS_TO_RECOVER) {
    results.push(await recoverOne(payload))
  }

  const summary = {
    total: results.length,
    created: results.filter(r => r.status === 'created').length,
    alreadyExisted: results.filter(r => r.status === 'already_exists').length,
    errors: results.filter(r => r.status === 'error').length,
  }

  return NextResponse.json({ summary, results }, { status: 200 })
}
