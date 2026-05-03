import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { parseSegment, resolveSegment, describeSegment } from '@/lib/email-segments'

export const dynamic = 'force-dynamic'

/**
 * Recebe `{ segment }` e devolve `{ total, sampled, description }`. UI
 * usa antes do admin disparar uma campanha pra mostrar quantas pessoas
 * vão ser atingidas + uma amostra de 10 e-mails (com nome) pra conferir.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  let body: { segment?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const segment = parseSegment(body.segment)
  if (!segment) {
    return NextResponse.json({ error: 'Segmento inválido.' }, { status: 400 })
  }

  try {
    const { total, sampled } = await resolveSegment(segment)
    return NextResponse.json({
      description: describeSegment(segment),
      total,
      sampled,
    })
  } catch (error) {
    console.error('[api/admin/email-campaigns/preview-segment] failed:', error)
    return NextResponse.json({ error: 'Erro ao calcular segmento.' }, { status: 500 })
  }
}
