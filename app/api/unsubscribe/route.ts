import { NextRequest, NextResponse } from 'next/server'
import { recordUnsubscribe, verifyUnsubscribeToken } from '@/lib/email-unsubscribe'

export const dynamic = 'force-dynamic'

/**
 * Endpoint público — recebe { email, token, reason? } e registra opt-out
 * se o token bater. Sem auth porque o token HMAC já garante autenticidade.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; token?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const email = (body.email || '').trim()
  const token = (body.token || '').trim()
  if (!email || !token) {
    return NextResponse.json({ error: 'Parâmetros incompletos.' }, { status: 400 })
  }
  if (!verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 403 })
  }

  const reason = body.reason && body.reason.trim() ? body.reason.trim().slice(0, 200) : undefined
  const result = await recordUnsubscribe(email, { reason, source: 'link' })
  if (!result.ok) {
    return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 503 })
  }
  return NextResponse.json({ success: true })
}
