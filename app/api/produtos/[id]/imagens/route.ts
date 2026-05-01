import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { addProductImage, listProductImages, reorderProductImages } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await context.params
  const images = await listProductImages(id)
  return NextResponse.json(images)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!body || typeof body.url !== 'string' || !body.url) {
    return NextResponse.json({ error: 'URL da imagem é obrigatória.' }, { status: 400 })
  }

  const result = await addProductImage(id, { url: body.url, alt: body.alt })
  if (!result.image) {
    return NextResponse.json({ error: result.error || 'Erro ao salvar imagem.' }, { status: 400 })
  }

  return NextResponse.json(result.image, { status: 201 })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.orderedIds)) {
    return NextResponse.json({ error: 'orderedIds é obrigatório.' }, { status: 400 })
  }

  const result = await reorderProductImages(id, body.orderedIds as string[])
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Erro ao reordenar.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
