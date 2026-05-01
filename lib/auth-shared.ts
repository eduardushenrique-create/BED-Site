export const SESSION_COOKIE = 'bed_session'

export function isAdminRole(role?: string | null) {
  return ['support', 'orders_manager', 'catalog_manager', 'admin', 'owner', 'global_admin'].includes(role || '')
}
