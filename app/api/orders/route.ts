import { NextResponse } from 'next/server'
import {
  createOrder,
  updateOrder,
  updateOrderPaymentByNumber,
  validateAndCalculateCoupon,
  incrementCouponUsage,
  decrementOrderStock,
  DatabaseUnavailableError,
} from '@/lib/database'
import { requireApiUser } from '@/lib/api-auth'
import { getLocalCatalogProducts } from '@/lib/catalog'
import { calculateShipping, SHIPPING_CONFIG } from '@/lib/shipping'
import { createPaymentForOrder, mapMercadoPagoStatus } from '@/lib/payment'
import { validateCEP, validateCPF, validateEmail } from '@/lib/validation'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'
import { withTimelineStamp, type ProductionTimeline } from '@/lib/order-statuses'

const log = createLogger({ component: 'api.orders' })

interface OrderItem {
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  quantity: number
  unitPrice: number
  personalization: Record<string, string> | null
}

interface OrderRequest {
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
  items: OrderItem[]
  shippingMethod: string
  paymentMethod?: string
  couponCode?: string
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  // ATENÇÃO: NÃO usar `&` — é caractere reservado em URLs e o
  // proxy/edge (Cloudflare/Railway) trata como início de query string,
  // truncando `params.orderNumber` em rotas dinâmicas. Use só
  // letras/números/hífen.
  return `BD-${timestamp}-${random}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser()
    if (auth.response) return auth.response

    const body: OrderRequest = await request.json()

    const {
      customerName,
      customerEmail,
      customerPhone,
      customerCpf,
      zipCode,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      items,
      shippingMethod,
      paymentMethod,
      couponCode,
    } = body

    if (!customerName || !customerEmail || !customerPhone || !customerCpf) {
      return NextResponse.json(
        { error: 'Dados do cliente incompletos' },
        { status: 400 }
      )
    }

    if (!validateEmail(customerEmail) || !validateCPF(customerCpf) || !validateCEP(zipCode)) {
      return NextResponse.json(
        { error: 'Dados do cliente ou endereço inválidos' },
        { status: 400 }
      )
    }

    if (!street || !number || !neighborhood || !city || !state) {
      return NextResponse.json(
        { error: 'Endereço de entrega incompleto' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Carrinho vazio' },
        { status: 400 }
      )
    }

    const catalog = await getLocalCatalogProducts()
    const orderItems = []
    let safeSubtotal = 0
    let packageWeight = 0
    let packageWidth = 11
    let packageHeight = 2
    let packageLength = 16

    for (const item of items) {
      const product = catalog.find(productItem => productItem.id === item.productId)
      if (!product || !product.isActive || product.status === 'draft') {
        return NextResponse.json({ error: 'Um item do carrinho não está disponível.' }, { status: 400 })
      }
      // Defense-in-depth: block internal products even if a tampered productId bypasses
      // the catalog filter (getLocalCatalogProducts already excludes visibility='internal').
      if (product.visibility === 'internal') {
        return NextResponse.json({ error: 'Um item do carrinho não está disponível.' }, { status: 400 })
      }

      const underOrder = product.underOrder || false
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))

      // Variant resolution and validation
      const productHasVariants = Array.isArray(product.variants) && product.variants.length > 0
      let resolvedVariant: typeof product.variants[number] | null = null

      if (item.variantId) {
        resolvedVariant = product.variants.find(v => v.id === item.variantId) || null
        if (!resolvedVariant) {
          return NextResponse.json({ error: 'Variação inválida.' }, { status: 400 })
        }
        if (resolvedVariant.isAvailable === false && !underOrder) {
          return NextResponse.json({ error: `Variação indisponível para ${product.name}.` }, { status: 400 })
        }
        const variantStock = resolvedVariant.stockQuantity ?? 0
        if (!underOrder && variantStock < quantity) {
          return NextResponse.json(
            { error: `Estoque insuficiente para a variação de ${product.name}.` },
            { status: 400 },
          )
        }
      } else if (productHasVariants) {
        return NextResponse.json(
          { error: `Selecione uma variação para ${product.name}.` },
          { status: 400 },
        )
      } else {
        const stock = product.stock || 0
        if (!underOrder && stock < quantity) {
          return NextResponse.json({ error: `Estoque insuficiente para ${product.name}.` }, { status: 400 })
        }
      }

      // Effective unit price
      const effectiveUnitPrice = resolvedVariant
        ? (resolvedVariant.priceOverride != null
            ? resolvedVariant.priceOverride
            : product.price + (resolvedVariant.priceDelta || 0))
        : product.price

      const lineTotal = effectiveUnitPrice * quantity
      safeSubtotal += lineTotal
      packageWeight += (product.weightGrams || 200) * quantity
      packageWidth = Math.max(packageWidth, product.widthCm || 11)
      packageHeight += (product.heightCm || 2) * quantity
      packageLength = Math.max(packageLength, product.depthCm || 16)

      orderItems.push({
        productId: product.id,
        productName: product.name,
        variantId: resolvedVariant?.id || null,
        variantName: resolvedVariant
          ? (item.variantName || resolvedVariant.name)
          : null,
        quantity,
        unitPrice: effectiveUnitPrice,
        personalization: item.personalization,
      })
    }

    const quotes = await calculateShipping(SHIPPING_CONFIG.originCep, zipCode, {
      weight: Math.max(packageWeight / 1000, 0.1),
      dimensions: {
        width: packageWidth,
        height: Math.max(packageHeight, 2),
        length: packageLength,
      },
    })
    const selectedQuote = quotes.find(quote => quote.id === shippingMethod)
    if (!selectedQuote) {
      return NextResponse.json({ error: 'Selecione uma opção de frete válida.' }, { status: 400 })
    }

    const safeShippingTotal = Number(selectedQuote.price || 0)

    // Server-side coupon revalidation. Never trust client-provided discount.
    let discountTotal = 0
    let appliedCouponCode: string | null = null
    if (typeof couponCode === 'string' && couponCode.trim()) {
      const couponResult = await validateAndCalculateCoupon(couponCode.trim(), safeSubtotal)
      if (!couponResult.ok) {
        return NextResponse.json({ error: couponResult.error }, { status: 400 })
      }
      discountTotal = couponResult.discount
      appliedCouponCode = couponResult.coupon.code
    }

    const safeTotal = Math.max(0, safeSubtotal + safeShippingTotal - discountTotal)
    const orderNumber = generateOrderNumber()

    const order = await createOrder({
      id: `order_${Date.now()}`,
      orderNumber,
      // SPEC-005 §9.1: pedido criado pelo CLIENTE (checkout publico).
      // Recebe email, aparece em /minha-conta.
      createdVia: 'site',
      customerName,
      customerEmail,
      customerPhone,
      customerCpf,
      shippingAddress: {
        zipCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
      },
      items: orderItems.map(item => ({
        productId: item.productId,
        productName: item.variantName ? `${item.productName} (${item.variantName})` : item.productName,
        variantId: item.variantId,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        observation: item.personalization ? JSON.stringify(item.personalization) : undefined,
      })),
      subtotal: safeSubtotal,
      shippingCost: safeShippingTotal,
      total: safeTotal,
      discountTotal,
      couponCode: appliedCouponCode,
      paymentMethod: paymentMethod || 'pix',
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      createdAt: new Date().toISOString(),
      trackingCode: null,
    })

    const payment = await createPaymentForOrder({
      orderNumber,
      amount: safeTotal,
      method: paymentMethod || 'pix',
      customer: {
        name: customerName,
        email: customerEmail,
        cpf: customerCpf,
      },
      items: orderItems.map(item => ({
        id: item.productId,
        title: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    })

    // Persist coupon snapshot inside Payment.rawPayload (no migration needed)
    const rawPayloadWithCoupon: Record<string, unknown> | null =
      appliedCouponCode || payment.rawPayload
        ? {
            ...(payment.rawPayload || {}),
            ...(appliedCouponCode
              ? { couponCode: appliedCouponCode, couponDiscount: discountTotal }
              : {}),
          }
        : null

    const mappedStatus = mapMercadoPagoStatus(payment.status)
    const updatedOrder = await updateOrderPaymentByNumber(orderNumber, {
      status: mappedStatus.orderStatus,
      paymentStatus: mappedStatus.paymentStatus,
      provider: payment.provider,
      method: paymentMethod || 'pix',
      amount: safeTotal,
      providerPaymentId: payment.providerPaymentId || null,
      pixQrCodeBase64: payment.pixQrCodeBase64 || null,
      pixCopyPaste: payment.pixCopyPaste || null,
      checkoutUrl: payment.checkoutUrl || null,
      rawPayload: rawPayloadWithCoupon,
    })

    // Pipeline-redesign (resposta 4 do stakeholder): pedido criado pelo site
    // sem pagamento concluido entra automaticamente em 'aguardando_pagamento'.
    // Pedido pago no checkout (raro com PIX, possivel com cartao approved) fica
    // em 'pending' para o admin validar (resposta 2: checagem de seguranca).
    if (updatedOrder && mappedStatus.paymentStatus !== 'paid') {
      try {
        const currentTimeline =
          (updatedOrder as unknown as { productionTimeline?: ProductionTimeline | null })
            .productionTimeline || null
        await updateOrder(updatedOrder.id, {
          fulfillmentStatus: 'aguardando_pagamento',
          productionTimeline: withTimelineStamp(currentTimeline, 'aguardando_pagamento'),
        } as Parameters<typeof updateOrder>[1])
      } catch (transitionError) {
        captureException(transitionError, {
          context: 'api.orders',
          detail: 'auto-transition to aguardando_pagamento failed',
          orderNumber,
        })
      }
    }

    // Hard-fail when the user picked card but Mercado Pago did not return a checkout URL.
    // Without checkoutUrl the client can't redirect to MP and the customer ends up at the
    // confirmation screen for an order that was never paid. The order stays in
    // pending_payment so an admin can investigate.
    if ((paymentMethod || 'pix') === 'card' && !payment.checkoutUrl) {
      captureException(new Error('Card checkout URL missing'), {
        context: 'api.orders',
        detail: 'card flow without checkoutUrl',
        orderNumber,
        provider: payment.provider,
        statusDetail: payment.statusDetail,
      })
      return NextResponse.json(
        {
          error: 'Não foi possível iniciar o pagamento com cartão. Tente novamente em instantes ou escolha Pix. Se persistir, fale com o suporte.',
          orderNumber,
        },
        { status: 502 },
      )
    }

    if (appliedCouponCode) {
      await incrementCouponUsage(appliedCouponCode)
    }

    // Best-effort stock decrement. Never block the order if this fails.
    try {
      await decrementOrderStock(
        orderItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      )
    } catch (stockError) {
      captureException(stockError, {
        context: 'api.orders',
        detail: 'decrementOrderStock failed',
        orderNumber,
      })
    }

    log.info({ orderNumber, customerEmail, total: safeTotal, paymentMethod }, 'Order created')

    return NextResponse.json({
      success: true,
      orderNumber,
      order: updatedOrder || order,
      payment,
      totals: {
        subtotal: safeSubtotal,
        shippingTotal: safeShippingTotal,
        discountTotal,
        couponCode: appliedCouponCode,
        total: safeTotal,
      },
      shipping: {
        provider: selectedQuote.company.name,
        service: selectedQuote.name,
        serviceCode: selectedQuote.id,
        estimatedDays: selectedQuote.deliveryTime.days,
      },
    })
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      captureException(error, { context: 'api.orders', detail: 'POST createOrder DB unavailable' })
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    captureException(error, { context: 'api.orders', detail: 'POST createOrder failed' })
    return NextResponse.json(
      { error: 'Erro ao criar pedido' },
      { status: 500 }
    )
  }
}
