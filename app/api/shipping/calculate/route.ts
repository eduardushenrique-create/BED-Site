import { NextResponse } from 'next/server'
import { calculateShipping } from '@/lib/shipping'

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
}

export async function POST(request: Request) {
  try {
    const body: ShippingRequest = await request.json()

    const { fromPostalCode, toPostalCode, packageInfo } = body

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