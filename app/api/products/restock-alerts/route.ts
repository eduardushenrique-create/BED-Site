import { NextRequest, NextResponse } from 'next/server'
import { subscribeToRestock, hasDatabase } from '@/lib/database'
import prisma from '@/lib/prisma'
import { validateEmail } from '@/lib/validation'
import {
  buildRateLimitKey,
  consumeRateLimit,
  getClientIp,
  rateLimitResponseBody,
} from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
  const variantId = typeof body?.variantId === 'string' ? body.variantId.trim() : null

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }
  if (!productId) {
    return NextResponse.json({ error: 'Produto é obrigatório.' }, { status: 400 })
  }

  const ip = getClientIp(request)

  const captcha = await verifyTurnstileToken(body?.turnstileToken, ip)
  if (!captcha.ok) {
    return NextResponse.json({ error: 'Verificação anti-bot falhou. Recarregue a página e tente novamente.' }, { status: 400 })
  }
  const ipLimit = await consumeRateLimit(buildRateLimitKey('restock-alert:ip', ip), 10, 600)
  if (!ipLimit.ok) {
    const { body: rlBody, status, headers } = rateLimitResponseBody(ipLimit)
    return NextResponse.json(rlBody, { status, headers })
  }
  const emailLimit = await consumeRateLimit(buildRateLimitKey('restock-alert:email', email.toLowerCase()), 5, 600)
  if (!emailLimit.ok) {
    const { body: rlBody, status, headers } = rateLimitResponseBody(emailLimit)
    return NextResponse.json(rlBody, { status, headers })
  }

  // Validate product exists, is active, and is publicly visible.
  // Return 404 in all failure cases to avoid leaking the existence of internal SKUs.
  if (hasDatabase && prisma?.product) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, isActive: true, visibility: true },
      })
      if (!product || !product.isActive || product.visibility === 'internal') {
        return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
      }
    } catch {
      // If DB check fails, let subscribeToRestock handle its own fallback path.
    }
  }

  try {
    const result = await subscribeToRestock({ email, productId, variantId })
    if (!result.ok) {
      return NextResponse.json({ error: 'Não foi possível registrar.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.products.restock-alerts' })
    return NextResponse.json({ error: 'Erro ao registrar.' }, { status: 500 })
  }
}
