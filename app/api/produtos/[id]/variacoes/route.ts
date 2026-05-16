import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import {
  createProductVariant,
  listProductVariants,
  type ProductVariantInput,
} from '@/lib/database'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'api/produtos/variacoes' })

export const dynamic = 'force-dynamic'

function isStringOrNullable(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string'
}

function isNumberOrNullable(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || typeof value === 'number'
}

function buildVariantInput(body: any): { input?: ProductVariantInput; error?: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Corpo da requisição inválido.' }
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return { error: 'name é obrigatório e deve ser string.' }
  }

  for (const key of ['sku', 'color', 'size', 'material', 'finish'] as const) {
    if (!isStringOrNullable(body[key])) {
      return { error: `${key} deve ser string ou null.` }
    }
  }

  if (!isNumberOrNullable(body.priceDelta)) {
    return { error: 'priceDelta deve ser número ou null.' }
  }
  if (!isNumberOrNullable(body.priceOverride)) {
    return { error: 'priceOverride deve ser número ou null.' }
  }
  if (body.stockQuantity !== undefined && typeof body.stockQuantity !== 'number') {
    return { error: 'stockQuantity deve ser número.' }
  }
  if (body.isAvailable !== undefined && typeof body.isAvailable !== 'boolean') {
    return { error: 'isAvailable deve ser boolean.' }
  }

  const input: ProductVariantInput = {
    name: body.name,
    sku: body.sku,
    color: body.color,
    size: body.size,
    material: body.material,
    finish: body.finish,
    priceDelta: body.priceDelta,
    priceOverride: body.priceOverride,
    stockQuantity: body.stockQuantity,
    isAvailable: body.isAvailable,
  }
  return { input }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    const variants = await listProductVariants(id)
    return NextResponse.json(variants)
  } catch (error) {
    captureException(error, { context: 'api/produtos/variacoes', detail: 'GET failed' })
    log.error({ err: error }, 'GET /produtos/variacoes erro')
    return NextResponse.json({ error: 'Erro ao listar variações.' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => null)

    const parsed = buildVariantInput(body)
    if (parsed.error || !parsed.input) {
      return NextResponse.json({ error: parsed.error || 'Corpo inválido.' }, { status: 400 })
    }

    const result = await createProductVariant(id, parsed.input)
    if (!result.ok || !result.variant) {
      const message = result.error || 'Erro ao criar variação.'
      const status = message === 'Produto não encontrado.' ? 404 : 400
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json(result.variant, { status: 201 })
  } catch (error) {
    captureException(error, { context: 'api/produtos/variacoes', detail: 'POST failed' })
    log.error({ err: error }, 'POST /produtos/variacoes erro')
    return NextResponse.json({ error: 'Erro interno ao criar variação.' }, { status: 500 })
  }
}
