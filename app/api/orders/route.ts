import { NextResponse } from 'next/server'

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
  subtotal: number
  shippingTotal: number
  total: number
  shippingMethod: string
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `B&D-${timestamp}-${random}`
}

export async function POST(request: Request) {
  try {
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
      subtotal,
      shippingTotal,
      total,
      shippingMethod,
    } = body

    if (!customerName || !customerEmail || !customerPhone || !customerCpf) {
      return NextResponse.json(
        { error: 'Dados do cliente incompletos' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Carrinho vazio' },
        { status: 400 }
      )
    }

    const orderNumber = generateOrderNumber()

    const order = {
      id: `order_${Date.now()}`,
      orderNumber,
      customerName,
      customerEmail,
      customerPhone,
      customerCpf,
      address: {
        zipCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
      },
      items: items.map(item => ({
        ...item,
        total: item.unitPrice * item.quantity,
      })),
      subtotal,
      shippingTotal,
      total,
      shippingMethod,
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      createdAt: new Date().toISOString(),
    }

    console.log('Order created:', orderNumber)

    return NextResponse.json({
      success: true,
      orderNumber,
      order,
    })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Erro ao criar pedido' },
      { status: 500 }
    )
  }
}