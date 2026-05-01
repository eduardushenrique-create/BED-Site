import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { removeProductImage, setMainProductImage } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id, imageId } = await context.params
  const body = await request.json().catch(() => ({}))

  if (body?.isMain === true) {
    const result = await setMainProductImage(id, imageId)
    if (!result.ok) return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Operação inválida. Use { isMain: true } para definir como principal.' }, { status: 400 })
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id, imageId } = await context.params
  const result = await removeProductImage(id, imageId)
  if (!result.ok) return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })

  return NextResponse.json({ success: true })
}
