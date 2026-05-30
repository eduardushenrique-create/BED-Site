import { NextRequest, NextResponse } from 'next/server'
import { safeInternalPath } from '@/lib/safe-redirect'

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  // A2: valida o redirect (só caminho interno) para evitar open redirect.
  const redirect = safeInternalPath(request.nextUrl.searchParams.get('redirect'), '/checkout')

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth ainda nao foi configurado no ambiente.' },
      { status: 501 }
    )
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${appUrl}/api/auth/google/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', Buffer.from(JSON.stringify({ redirect })).toString('base64url'))
  url.searchParams.set('prompt', 'select_account')

  return NextResponse.redirect(url)
}
