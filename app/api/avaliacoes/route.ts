import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { listReviewsAdmin, type ReviewStatus } from '@/lib/reviews'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as ReviewStatus | null
    const productId = searchParams.get('productId') || undefined
    const result = await listReviewsAdmin({
      status: status || undefined,
      productId,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    captureException(error, { context: 'api.avaliacoes' })
    return NextResponse.json({ error: 'Erro ao listar avaliações.' }, { status: 500 })
  }
}
