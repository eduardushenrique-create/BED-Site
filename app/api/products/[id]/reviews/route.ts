import { NextRequest, NextResponse } from 'next/server'
import { listApprovedReviewsForProduct } from '@/lib/reviews'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 })
    const result = await listApprovedReviewsForProduct(id)
    return NextResponse.json(result)
  } catch (error) {
    captureException(error, { context: 'api.products.[id].reviews' })
    return NextResponse.json({ error: 'Erro ao buscar avaliações.' }, { status: 500 })
  }
}
