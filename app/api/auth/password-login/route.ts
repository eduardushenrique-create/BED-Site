import { NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { authenticateAdminWithPassword } from '@/lib/auth-password'
import { validateEmail } from '@/lib/validation'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (!email || !validateEmail(email) || !password) {
    return NextResponse.json({ error: 'Informe e-mail e senha válidos.' }, { status: 400 })
  }

  const user = await authenticateAdminWithPassword(email, password)
  if (!user) {
    return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
  }

  await createSession(user)
  return NextResponse.json({ success: true, user })
}
