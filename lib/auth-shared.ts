export const SESSION_COOKIE = 'bed_session'

export const ADMIN_ROLES = ['support', 'orders_manager', 'catalog_manager', 'admin', 'owner', 'global_admin'] as const

// Grupos de privilégio para RBAC (M1). Todos incluem admin/owner/global_admin
// para NÃO bloquear quem hoje opera o painel; restringem apenas os papéis
// especializados de menor alçada (support / orders_manager / catalog_manager).
// Ajuste a matriz conforme a política de papéis evoluir.
export const PRIVILEGED_ROLES = ['admin', 'owner', 'global_admin'] as const
export const CATALOG_ROLES = ['catalog_manager', 'admin', 'owner', 'global_admin'] as const
export const ORDERS_ROLES = ['orders_manager', 'admin', 'owner', 'global_admin'] as const

export function isAdminRole(role?: string | null) {
  return (ADMIN_ROLES as readonly string[]).includes(role || '')
}

export function hasRole(role: string | null | undefined, allowed: readonly string[]) {
  return allowed.includes(role || '')
}
