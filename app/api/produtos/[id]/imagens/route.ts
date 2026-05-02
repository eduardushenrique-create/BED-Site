import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { addProductImage, listProductImages, reorderProductImages } from '@/lib/database'
import { getStorage } from '@/lib/storage'
import { extractContentType, isDataUrl } from '@/lib/storage/data-url'

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

  // Se a `url` recebida é uma data URL, faz upload aqui via storage adapter
  // (R2 quando configurado; senão InlineStorage devolve a própria data URL).
  let url = body.url as string
  let storageKey: string | null = null
  if (isDataUrl(url)) {
    try {
      const contentType = extractContentType(url, 'image/jpeg')
      const uploaded = await getStorage().upload({ data: url, contentType, prefix: 'products' })
      url = uploaded.url
      storageKey = uploaded.storageKey
    } catch (uploadError) {
      console.error('[POST /produtos/imagens] storage upload falhou:', uploadError)
      return NextResponse.json({ error: 'Falha ao salvar a imagem no storage.' }, { status: 500 })
    }
  }

  const result = await addProductImage(id, { url, alt: body.alt, storageKey })
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
