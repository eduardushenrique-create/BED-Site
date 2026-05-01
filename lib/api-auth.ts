import 'server-only'

import { NextResponse } from 'next/server'
import { getSessionUser, isAdminRole } from '@/lib/auth'

export async function requireApiUser() {
  const user = await getSessionUser()
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 }) }
  }
  return { user, response: null }
}

export async function requireApiAdmin() {
  const { user, response } = await requireApiUser()
  if (response) return { user: null, response }
  if (!isAdminRole(user?.role)) {
    return { user: null, response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }
  return { user, response: null }
}
