import 'server-only'

import { NextResponse } from 'next/server'
import { getSessionUser, isAdminRole } from '@/lib/auth'
import { hasRole } from '@/lib/auth-shared'

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

/**
 * Como requireApiAdmin, mas exige que o papel esteja na lista `allowed` (RBAC,
 * M1). Use com os grupos de lib/auth-shared (PRIVILEGED_ROLES, CATALOG_ROLES,
 * ORDERS_ROLES) para aplicar menor privilégio em ações sensíveis/destrutivas.
 */
export async function requireApiRole(allowed: readonly string[]) {
  const { user, response } = await requireApiAdmin()
  if (response) return { user: null, response }
  if (!hasRole(user?.role, allowed)) {
    return { user: null, response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }
  return { user, response: null }
}
