import { NextResponse } from 'next/server'
import { createOrder } from '@/lib/database'
import { requireApiUser } from '@/lib/api-auth'
import { getLocalCatalogProducts } from '@/lib/catalog'
import { calculateShipping, SHIPPING_CONFIG } from '@/lib/shipping'
import { validateCEP, validateCPF, validateEmail } from '@/lib/validation'

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
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `B&D-${timestamp}-${random}`
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

      const stock = product.stock || 0
      const underOrder = product.underOrder || false
      if (!underOrder && stock < item.quantity) {
        return NextResponse.json({ error: `Estoque insuficiente para ${product.name}.` }, { status: 400 })
      }

      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
      const lineTotal = product.price * quantity
      safeSubtotal += lineTotal
      packageWeight += (product.weightGrams || 200) * quantity
      packageWidth = Math.max(packageWidth, product.widthCm || 11)
      packageHeight += (product.heightCm || 2) * quantity
      packageLength = Math.max(packageLength, product.depthCm || 16)

      orderItems.push({
        productId: product.id,
        productName: product.name,
        variantId: item.variantId,
        variantName: item.variantName,
        quantity,
        unitPrice: product.price,
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
    const safeTotal = safeSubtotal + safeShippingTotal
    const orderNumber = generateOrderNumber()

    const order = await createOrder({
      id: `order_${Date.now()}`,
      orderNumber,
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
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        observation: item.personalization ? JSON.stringify(item.personalization) : undefined,
      })),
      subtotal: safeSubtotal,
      shippingCost: safeShippingTotal,
      total: safeTotal,
      paymentMethod: paymentMethod || 'pix',
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      createdAt: new Date().toISOString(),
      trackingCode: null,
    })

    console.log('Order created:', orderNumber)

    return NextResponse.json({
      success: true,
      orderNumber,
      order,
      totals: {
        subtotal: safeSubtotal,
        shippingTotal: safeShippingTotal,
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
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Erro ao criar pedido' },
      { status: 500 }
    )
  }
}
