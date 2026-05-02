import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'
import { getCustomerByEmail } from '@/lib/database'
import { createReview, isCustomerEligibleToReview } from '@/lib/reviews'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  const productId = new URL(request.url).searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId é obrigatório.' }, { status: 400 })
  }

  const result = await isCustomerEligibleToReview(auth.user!.email, productId)
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => null)
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    const rating = Number(body?.rating)
    const title = typeof body?.title === 'string' ? body.title : null
    const reviewBody = typeof body?.body === 'string' ? body.body : null

    if (!productId) {
      return NextResponse.json({ error: 'productId é obrigatório.' }, { status: 400 })
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Avalie de 1 a 5 estrelas.' }, { status: 400 })
    }

    const eligibility = await isCustomerEligibleToReview(auth.user!.email, productId)
    if (!eligibility.eligible) {
      const message = eligibility.reason === 'already_reviewed'
        ? 'Você já avaliou este produto.'
        : 'Apenas clientes que compraram este produto podem avaliar.'
      return NextResponse.json({ error: message }, { status: 403 })
    }

    const customer = await getCustomerByEmail(auth.user!.email)

    const result = await createReview({
      productId,
      customerId: customer?.id || null,
      customerName: customer?.name || auth.user!.name || 'Cliente',
      customerEmail: auth.user!.email,
      orderNumber: eligibility.orderNumber || null,
      rating,
      title,
      body: reviewBody,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Erro ao salvar avaliação.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, review: result.review }, { status: 201 })
  } catch (error) {
    captureException(error, { context: 'api.me.reviews' })
    return NextResponse.json({ error: 'Erro ao salvar avaliação.' }, { status: 500 })
  }
}
