import { NextResponse } from 'next/server'
import { calculateShipping } from '@/lib/shipping'
import { getLocalCatalogProducts } from '@/lib/catalog'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'

interface ShippingRequest {
  fromPostalCode: string
  toPostalCode: string
  packageInfo: {
    weight: number
    dimensions: {
      width: number
      height: number
      length: number
    }
  }
  items?: Array<{ productId: string; quantity: number }>
}

export async function POST(request: Request) {
  try {
    // A4 — cada cotação aciona a API do Melhor Envio (cota limitada). Sem
    // throttle, dá pra exaurir/bloquear o token do ME ou fazer scraping de
    // cotações. 30 req / 60 s por IP cobre o uso normal (recalcular no carrinho).
    const rl = await consumeRateLimit(buildRateLimitKey('shipping-calculate', getClientIp(request)), 30, 60)
    if (!rl.ok) {
      const { body, status, headers } = rateLimitResponseBody(rl)
      return NextResponse.json(body, { status, headers })
    }

    const body: ShippingRequest = await request.json()

    const { fromPostalCode, toPostalCode } = body
    let { packageInfo } = body

    if (!fromPostalCode || !toPostalCode) {
      return NextResponse.json(
        { error: 'CEP de origem e destino são obrigatórios' },
        { status: 400 }
      )
    }

    const fromZip = fromPostalCode.replace(/\D/g, '')
    const toZip = toPostalCode.replace(/\D/g, '')

    if (fromZip.length !== 8 || toZip.length !== 8) {
      return NextResponse.json(
        { error: 'CEP inválido' },
        { status: 400 }
      )
    }

    if (!packageInfo && body.items?.length) {
      const catalog = await getLocalCatalogProducts()
      let weight = 0
      let width = 11
      let height = 2
      let length = 16

      for (const item of body.items) {
        const product = catalog.find(productItem => productItem.id === item.productId)
        if (!product) continue
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
        weight += (product.weightGrams || 200) * quantity
        width = Math.max(width, product.widthCm || 11)
        height += (product.heightCm || 2) * quantity
        length = Math.max(length, product.depthCm || 16)
      }

      packageInfo = {
        weight: Math.max(weight / 1000, 0.1),
        dimensions: { width, height, length },
      }
    }

    if (!packageInfo) {
      return NextResponse.json(
        { error: 'Itens do carrinho são obrigatórios para calcular frete' },
        { status: 400 }
      )
    }

    const quotes = await calculateShipping(fromZip, toZip, packageInfo)

    return NextResponse.json(quotes)
  } catch (error) {
    console.error('Shipping API error:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular frete' },
      { status: 500 }
    )
  }
}
