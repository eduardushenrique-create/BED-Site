const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN
const MELHOR_ENVIO_URL = 'https://www.melhorenvio.com.br/api/v2'

const CEP_ORIGEM = process.env.SHIPPING_ORIGIN_CEP || '01001000'

export const SHIPPING_CONFIG = {
  originCep: CEP_ORIGEM,
}

export interface ShippingQuote {
  id: string
  name: string
  price: number
  currency: string
  deliveryTime: {
    days: number
    min?: number
    max?: number
  }
  company: {
    name: string
    picture: string
  }
}

export interface ShippingAddress {
  postalCode: string
  street: string
  number: string
  complement?: string
  district: string
  city: string
  state: string
}

export interface ShippingPackage {
  weight: number
  dimensions: {
    width: number
    height: number
    length: number
  }
}

export async function calculateShipping(
  fromPostalCode: string,
  toPostalCode: string,
  packageInfo: ShippingPackage
): Promise<ShippingQuote[]> {
  if (!MELHOR_ENVIO_TOKEN) {
    console.warn('Melhor Envio token not configured')
    return getMockShippingQuotes()
  }

  try {
    const response = await fetch(`${MELHOR_ENVIO_URL}/shipping.calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        from: { postal_code: fromPostalCode },
        to: { postal_code: toPostalCode },
        package: packageInfo,
      }),
    })

    if (!response.ok) {
      console.error('Melhor Envio API error:', await response.text())
      return getMockShippingQuotes()
    }

    const data = await response.json()

    return data.map((option: Record<string, unknown>) => ({
      id: option.id as string,
      name: option.name as string,
      price: option.price as number,
      currency: 'BRL',
      deliveryTime: {
        days: (option.delivery_time as { days?: number })?.days || 5,
        min: (option.delivery_time as { min?: number })?.min,
        max: (option.delivery_time as { max?: number })?.max,
      },
      company: {
        name: (option.company as { name?: string })?.name || option.name as string,
        picture: (option.company as { picture?: string })?.picture || '',
      },
    }))
  } catch (error) {
    console.error('Error calculating shipping:', error)
    return getMockShippingQuotes()
  }
}

function getMockShippingQuotes(): ShippingQuote[] {
  return [
    {
      id: 'pac',
      name: 'PAC',
      price: 15.90,
      currency: 'BRL',
      deliveryTime: { days: 7, min: 5, max: 7 },
      company: { name: 'Correios', picture: '' },
    },
    {
      id: 'sedex',
      name: 'SEDEX',
      price: 25.90,
      currency: 'BRL',
      deliveryTime: { days: 3, min: 2, max: 3 },
      company: { name: 'Correios', picture: '' },
    },
  ]
}

export interface ShipmentData {
  orderId: string
  from: {
    name: string
    document: string
    postalCode: string
    street: string
    number: string
    complement?: string
    district: string
    city: string
    state: string
    email: string
    phone: string
  }
  to: {
    name: string
    document: string
    postalCode: string
    street: string
    number: string
    complement?: string
    district: string
    city: string
    state: string
    email: string
    phone: string
  }
  package: {
    weight: number
    dimensions: {
      width: number
      height: number
      length: number
    }
  }
  service: string
}

export async function createShipment(data: ShipmentData): Promise<{ trackingCode?: string; labelUrl?: string } | null> {
  if (!MELHOR_ENVIO_TOKEN) {
    console.warn('Melhor Envio token not configured')
    return { trackingCode: 'MOCK123456BR', labelUrl: '#' }
  }

  try {
    const response = await fetch(`${MELHOR_ENVIO_URL}/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        service: data.service,
        from: data.from,
        to: data.to,
        package: data.package,
      }),
    })

    if (!response.ok) {
      console.error('Melhor Envio shipment error:', await response.text())
      return null
    }

    const result = await response.json()
    return {
      trackingCode: result.tracking,
      labelUrl: result.label,
    }
  } catch (error) {
    console.error('Error creating shipment:', error)
    return null
  }
}

export async function getTrackingInfo(trackingCode: string): Promise<{
  status: string
  events: Array<{ date: string; description: string; location: string }>
} | null> {
  if (!MELHOR_ENVIO_TOKEN) {
    return {
      status: 'Em trânsito',
      events: [
        {
          date: new Date().toISOString(),
          description: 'Objeto em trânsito',
          location: 'São Paulo, SP',
        },
      ],
    }
  }

  try {
    const response = await fetch(
      `${MELHOR_ENVIO_URL}/shipments/tracking/${trackingCode}`,
      {
        headers: {
          'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting tracking:', error)
    return null
  }
}