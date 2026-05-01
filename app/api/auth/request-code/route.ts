import { NextRequest, NextResponse } from 'next/server'
import { generateAccessCode, storeAccessCode } from '@/lib/auth-codes'
import { sendAccessCodeEmail } from '@/lib/email'
import { validateEmail } from '@/lib/validation'

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }

    const code = generateAccessCode()
    await storeAccessCode(email, code, getIp(request))
    await sendAccessCodeEmail(email, code)

    return NextResponse.json({
      success: true,
      message: 'Enviamos um código de acesso para o seu e-mail.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar código.'
    return NextResponse.json({ error: message }, { status: 429 })
  }
}
