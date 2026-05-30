import crypto from 'crypto'

/**
 * Hash curto e estável de e-mail para logs/correlação SEM expor PII (LGPD,
 * art. 46). Não é reversível — serve só para correlacionar eventos do mesmo
 * cliente nos logs sem gravar o e-mail em claro. (M6)
 */
export function hashEmail(email: string | null | undefined): string {
  if (!email) return 'none'
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12)
}
