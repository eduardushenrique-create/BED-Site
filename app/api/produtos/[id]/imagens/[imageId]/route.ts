import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { removeProductImage, setMainProductImage, setVariantForImage } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id, imageId } = await context.params
    const body = await request.json().catch(() => ({}))

    const hasVariantField = body && typeof body === 'object' && 'variantId' in body

    if (hasVariantField) {
      const variantId = body.variantId
      if (variantId !== null && typeof variantId !== 'string') {
        return NextResponse.json(
          { error: 'variantId deve ser string ou null.' },
          { status: 400 }
        )
      }
      const result = await setVariantForImage(id, imageId, variantId)
      if (!result.ok) {
        const message = result.error || 'Erro ao vincular variação.'
        const status =
          message === 'Imagem não encontrada.' ||
          message === 'Variação não encontrada para este produto.'
            ? 404
            : 400
        return NextResponse.json({ error: message }, { status })
      }
      return NextResponse.json(result.image ?? { success: true })
    }

    if (body?.isMain === true) {
      const result = await setMainProductImage(id, imageId)
      if (!result.ok) return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Operação inválida. Use { isMain: true } ou { variantId: string | null }.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[PATCH /produtos/imagens/:imageId] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao atualizar imagem.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id, imageId } = await context.params
    const result = await removeProductImage(id, imageId)
    if (!result.ok) return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /produtos/imagens/:imageId] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao remover imagem.' }, { status: 500 })
  }
}
