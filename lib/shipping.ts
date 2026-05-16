import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'shipping' })

const MELHOR_ENVIO_BASE = 'https://www.melhorenvio.com.br/api/v2/me'

const CEP_ORIGEM = process.env.SHIPPING_ORIGIN_CEP || '01001000'

export const SHIPPING_CONFIG = {
  originCep: CEP_ORIGEM,
}

// Read at request time so Railway env updates take effect without rebuild.
function getToken(): string | undefined {
  return process.env.MELHOR_ENVIO_TOKEN
}

// ME requires a User-Agent string identifying the app + a contact email.
// Reference: https://docs.melhorenvio.com.br/reference/como-fazer-uma-requisicao
function getUserAgent(): string {
  const email = process.env.MELHOR_ENVIO_CONTACT_EMAIL || 'eduardus.henrique@gmail.com'
  return `BED Design (${email})`
}

function sanitizeCep(cep: string): string {
  return String(cep || '').replace(/\D/g, '')
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
  const token = getToken()
  if (!token) {
    log.warn('[shipping] Melhor Envio token not configured — returning mock quotes')
    return getMockShippingQuotes()
  }

  try {
    const fromCep = sanitizeCep(fromPostalCode)
    const toCep = sanitizeCep(toPostalCode)

    const response = await fetch(`${MELHOR_ENVIO_BASE}/shipment/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({
        from: { postal_code: fromCep },
        to: { postal_code: toCep },
        // ME aceita 'package' (peso + dimensões) ou 'products' (lista). Manter
        // o formato legado por compatibilidade — peso em kg, dimensões em cm.
        package: {
          weight: Number(packageInfo.weight) || 0.3,
          width: Number(packageInfo.dimensions?.width) || 11,
          height: Number(packageInfo.dimensions?.height) || 2,
          length: Number(packageInfo.dimensions?.length) || 16,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      const apiErr = new Error(`Melhor Envio API error ${response.status}: ${errorBody}`)
      captureException(apiErr, { context: 'shipping', detail: 'Melhor Envio API error' })
      log.error({ status: response.status, body: errorBody }, 'Melhor Envio API error')
      return getMockShippingQuotes()
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      const shapeErr = new Error('Melhor Envio unexpected payload shape')
      captureException(shapeErr, { context: 'shipping', detail: JSON.stringify(data).slice(0, 200) })
      log.error({ payload: JSON.stringify(data).slice(0, 200) }, 'Melhor Envio unexpected payload shape')
      return getMockShippingQuotes()
    }

    // ME pode devolver opções com `error` (quando a transportadora não atende
    // aquele trecho ou o pacote excede limites). Filtramos essas e mapeamos
    // o restante para o formato interno.
    const quotes: ShippingQuote[] = []
    for (const option of data as Array<Record<string, unknown>>) {
      if (option?.error) continue
      const priceRaw = option.price ?? option.custom_price
      const priceNum = typeof priceRaw === 'string' ? Number(priceRaw) : Number(priceRaw)
      if (!Number.isFinite(priceNum) || priceNum <= 0) continue

      const company = option.company as { name?: string; picture?: string } | undefined
      const deliveryTimeRaw = option.delivery_time
      const deliveryTime = typeof deliveryTimeRaw === 'object' && deliveryTimeRaw !== null
        ? deliveryTimeRaw as { days?: number; min?: number; max?: number }
        : { days: typeof deliveryTimeRaw === 'number' ? deliveryTimeRaw : 5 }

      quotes.push({
        id: String(option.id ?? ''),
        name: String(option.name ?? 'Frete'),
        price: priceNum,
        currency: 'BRL',
        deliveryTime: {
          days: deliveryTime.days ?? deliveryTime.max ?? 5,
          min: deliveryTime.min,
          max: deliveryTime.max,
        },
        company: {
          name: company?.name || String(option.name ?? 'Transportadora'),
          picture: company?.picture || '',
        },
      })
    }

    if (quotes.length === 0) {
      log.warn({ fromCep, toCep }, 'Melhor Envio returned no usable quotes')
      return getMockShippingQuotes()
    }

    return quotes
  } catch (error) {
    captureException(error, { context: 'shipping', detail: 'calculateShipping threw' })
    log.error({ err: error }, 'calculateShipping threw')
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
  const token = getToken()
  if (!token) {
    log.warn('[shipping] Melhor Envio token not configured — returning mock shipment')
    return { trackingCode: 'MOCK123456BR', labelUrl: '#' }
  }

  try {
    const response = await fetch(`${MELHOR_ENVIO_BASE}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({
        service: data.service,
        from: data.from,
        to: data.to,
        package: data.package,
      }),
    })

    if (!response.ok) {
      const shipErr = new Error(`Melhor Envio createShipment error: ${await response.text()}`)
      captureException(shipErr, { context: 'shipping', detail: 'createShipment non-ok response' })
      log.error({ status: response.status }, 'Melhor Envio createShipment non-ok response')
      return null
    }

    const result = await response.json()
    return {
      trackingCode: result.tracking,
      labelUrl: result.label,
    }
  } catch (error) {
    captureException(error, { context: 'shipping', detail: 'createShipment threw' })
    log.error({ err: error }, 'createShipment threw')
    return null
  }
}

export async function getTrackingInfo(trackingCode: string): Promise<{
  status: string
  events: Array<{ date: string; description: string; location: string }>
} | null> {
  const token = getToken()
  if (!token) {
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
      `${MELHOR_ENVIO_BASE}/shipment/tracking?orders[]=${encodeURIComponent(trackingCode)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': getUserAgent(),
        },
      }
    )

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    captureException(error, { context: 'shipping', detail: 'getTrackingInfo threw' })
    log.error({ err: error }, 'getTrackingInfo threw')
    return null
  }
}