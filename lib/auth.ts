import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decodeSessionToken, encodeSessionToken } from '@/lib/session-token'
import { SESSION_COOKIE, isAdminRole } from '@/lib/auth-shared'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export type AuthRole = 'customer' | 'support' | 'orders_manager' | 'catalog_manager' | 'admin' | 'owner' | 'global_admin'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: AuthRole
}

type SessionPayload = SessionUser & {
  exp: number
}

export function decodeSessionCookie(value?: string | null): SessionUser | null {
  const payload = decodeSessionToken(value) as SessionPayload | null
  if (!payload) return null
  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    role: payload.role as AuthRole,
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  return decodeSessionCookie(cookieStore.get(SESSION_COOKIE)?.value)
}

export async function createSession(user: SessionUser) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, encodeSessionToken({
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function requireUser(redirectTo = '/login') {
  const user = await getSessionUser()
  if (!user) redirect(redirectTo)
  return user
}

export async function requireAdmin() {
  const user = await requireUser('/login?redirect=/admin')
  if (!isAdminRole(user.role)) redirect('/403')
  return user
}

export { SESSION_COOKIE, isAdminRole }
