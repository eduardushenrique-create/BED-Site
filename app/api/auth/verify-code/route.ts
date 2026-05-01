import { NextResponse } from 'next/server'
import { consumeAccessCode } from '@/lib/auth-codes'
import { createSession } from '@/lib/auth'
import { findOrCreateSessionUser } from '@/lib/auth-users'
import { validateEmail } from '@/lib/validation'

export async function POST(request: Request) {
  const { email, code, name } = await request.json()

  if (!email || !validateEmail(email) || !code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'E-mail ou código inválido.' }, { status: 400 })
  }

  const valid = await consumeAccessCode(email, String(code))
  if (!valid) {
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 })
  }

  const user = await findOrCreateSessionUser(email, name)
  await createSession(user)

  return NextResponse.json({ success: true, user })
}
