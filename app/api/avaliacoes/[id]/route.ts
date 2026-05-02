import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { deleteReview, moderateReview, type ReviewStatus } from '@/lib/reviews'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: ReviewStatus[] = ['pending', 'approved', 'hidden']

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 })

    const body = await request.json().catch(() => null)
    const status = body?.status as ReviewStatus | undefined
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'status inválido.' }, { status: 400 })
    }

    const result = await moderateReview(id, status, auth.user!.email)
    if (!result.ok) {
      return NextResponse.json({ error: 'Avaliação não encontrada.' }, { status: 404 })
    }

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: `review.moderate.${status}`,
      targetType: 'Review',
      targetId: id,
      summary: `Avaliação ${status} (${result.review?.rating}★ por ${result.review?.customerEmail})`,
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({ ok: true, review: result.review })
  } catch (error) {
    captureException(error, { context: 'api.avaliacoes.[id].PATCH' })
    return NextResponse.json({ error: 'Erro ao moderar.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 })

    const ok = await deleteReview(id)
    if (!ok) return NextResponse.json({ error: 'Avaliação não encontrada.' }, { status: 404 })

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'review.delete',
      targetType: 'Review',
      targetId: id,
      summary: 'Avaliação excluída',
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.avaliacoes.[id].DELETE' })
    return NextResponse.json({ error: 'Erro ao excluir.' }, { status: 500 })
  }
}
