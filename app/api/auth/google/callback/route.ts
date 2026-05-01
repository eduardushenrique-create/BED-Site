import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { findOrCreateSessionUser } from '@/lib/auth-users'

type GoogleTokenResponse = {
  access_token?: string
  id_token?: string
  error?: string
}

type GoogleUserInfo = {
  email?: string
  name?: string
}

function readState(value: string | null) {
  if (!value) return { redirect: '/checkout' }
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { redirect?: string }
  } catch {
    return { redirect: '/checkout' }
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = readState(request.nextUrl.searchParams.get('state'))
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  if (!code || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/login?error=google', request.url))
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  const token = await tokenRes.json() as GoogleTokenResponse
  if (!tokenRes.ok || !token.access_token) {
    return NextResponse.redirect(new URL('/login?error=google', request.url))
  }

  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  const profile = await userRes.json() as GoogleUserInfo

  if (!userRes.ok || !profile.email) {
    return NextResponse.redirect(new URL('/login?error=google', request.url))
  }

  const user = await findOrCreateSessionUser(profile.email, profile.name)
  await createSession(user)

  return NextResponse.redirect(new URL(state.redirect || '/checkout', request.url))
}
