import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import {
  deleteProductVariant,
  updateProductVariant,
  type ProductVariantInput,
} from '@/lib/database'

export const dynamic = 'force-dynamic'

function isStringOrNullable(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string'
}

function isNumberOrNullable(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || typeof value === 'number'
}

function buildPartialInput(body: any): { input?: ProductVariantInput; error?: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Corpo da requisição inválido.' }
  }

  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return { error: 'name deve ser string não vazia.' }
  }

  for (const key of ['sku', 'color', 'size', 'material', 'finish'] as const) {
    if (body[key] !== undefined && !isStringOrNullable(body[key])) {
      return { error: `${key} deve ser string ou null.` }
    }
  }

  if (body.priceDelta !== undefined && !isNumberOrNullable(body.priceDelta)) {
    return { error: 'priceDelta deve ser número ou null.' }
  }
  if (body.priceOverride !== undefined && !isNumberOrNullable(body.priceOverride)) {
    return { error: 'priceOverride deve ser número ou null.' }
  }
  if (body.stockQuantity !== undefined && typeof body.stockQuantity !== 'number') {
    return { error: 'stockQuantity deve ser número.' }
  }
  if (body.isAvailable !== undefined && typeof body.isAvailable !== 'boolean') {
    return { error: 'isAvailable deve ser boolean.' }
  }

  const input: ProductVariantInput = {}
  if (body.name !== undefined) input.name = body.name
  if (body.sku !== undefined) input.sku = body.sku
  if (body.color !== undefined) input.color = body.color
  if (body.size !== undefined) input.size = body.size
  if (body.material !== undefined) input.material = body.material
  if (body.finish !== undefined) input.finish = body.finish
  if (body.priceDelta !== undefined) input.priceDelta = body.priceDelta
  if (body.priceOverride !== undefined) input.priceOverride = body.priceOverride
  if (body.stockQuantity !== undefined) input.stockQuantity = body.stockQuantity
  if (body.isAvailable !== undefined) input.isAvailable = body.isAvailable
  return { input }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; variantId: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id, variantId } = await context.params
    const body = await request.json().catch(() => null)

    const parsed = buildPartialInput(body)
    if (parsed.error || !parsed.input) {
      return NextResponse.json({ error: parsed.error || 'Corpo inválido.' }, { status: 400 })
    }

    const result = await updateProductVariant(id, variantId, parsed.input)
    if (!result.ok || !result.variant) {
      const message = result.error || 'Erro ao atualizar variação.'
      const status = message === 'Variação não encontrada.' ? 404 : 400
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json(result.variant)
  } catch (error) {
    console.error('[PATCH /produtos/variacoes/:variantId] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao atualizar variação.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; variantId: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id, variantId } = await context.params
    const result = await deleteProductVariant(id, variantId)
    if (!result.ok) {
      const message = result.error || 'Erro ao remover variação.'
      const status = message === 'Variação não encontrada.' ? 404 : 400
      return NextResponse.json({ error: message }, { status })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /produtos/variacoes/:variantId] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao remover variação.' }, { status: 500 })
  }
}
