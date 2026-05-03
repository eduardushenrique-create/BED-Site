import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

/**
 * Segmento de campanha — descreve QUEM recebe o e-mail.
 *
 * `type` controla a estratégia de busca; campos extras parametrizam.
 * O resultado de `resolveSegment()` é uma lista deduplicada de e-mails
 * que NÃO estão na tabela EmailUnsubscribe.
 *
 * Estratégias atuais:
 *   - all: todos os clientes cadastrados (verified)
 *   - paid_recent: clientes com pelo menos 1 pedido pago nos últimos N dias
 *   - top_spenders: top N clientes por valor total de pedidos pagos
 *   - has_wishlist: clientes com pelo menos 1 item na wishlist
 *
 * Adicionar nova estratégia = mais um case no switch + UI no admin.
 * O JSONB no banco preserva qualquer campo extra que a UI envie, então
 * dá pra evoluir sem migration.
 */
export type EmailSegment =
  | { type: 'all' }
  | { type: 'paid_recent'; lastDays: number }
  | { type: 'top_spenders'; limit: number }
  | { type: 'has_wishlist' }

export interface SegmentResolution {
  emails: string[]
  total: number
  sampled: { email: string; name: string | null }[]
}

const SAMPLE_SIZE = 10

function isValidSegment(value: unknown): value is EmailSegment {
  if (!value || typeof value !== 'object') return false
  const v = value as { type?: string }
  if (v.type === 'all' || v.type === 'has_wishlist') return true
  if (v.type === 'paid_recent') {
    return typeof (v as { lastDays?: unknown }).lastDays === 'number'
  }
  if (v.type === 'top_spenders') {
    return typeof (v as { limit?: unknown }).limit === 'number'
  }
  return false
}

export function parseSegment(input: unknown): EmailSegment | null {
  return isValidSegment(input) ? input : null
}

export function describeSegment(segment: EmailSegment): string {
  switch (segment.type) {
    case 'all':
      return 'Todos os clientes verificados'
    case 'paid_recent':
      return `Clientes com pedido pago nos últimos ${segment.lastDays} dias`
    case 'top_spenders':
      return `Top ${segment.limit} clientes por valor de compras`
    case 'has_wishlist':
      return 'Clientes com itens na wishlist'
  }
}

/**
 * Resolve o segmento em uma lista de destinatários únicos, sem opt-outs.
 * Sempre devolve dados — mesmo sem banco, retorna lista vazia (no-op).
 */
export async function resolveSegment(segment: EmailSegment): Promise<SegmentResolution> {
  if (!hasDatabase || !prisma) {
    return { emails: [], total: 0, sampled: [] }
  }

  const candidates = await fetchCandidates(segment)
  const uniqueByEmail = new Map<string, { email: string; name: string | null }>()
  for (const c of candidates) {
    const key = c.email.trim().toLowerCase()
    if (!key) continue
    if (!uniqueByEmail.has(key)) uniqueByEmail.set(key, { email: key, name: c.name })
  }

  // Filtra opt-outs.
  const allEmails = Array.from(uniqueByEmail.keys())
  if (allEmails.length === 0) return { emails: [], total: 0, sampled: [] }

  const optedOut = await prisma.emailUnsubscribe.findMany({
    where: { email: { in: allEmails } },
    select: { email: true },
  })
  const optedOutSet = new Set(optedOut.map(row => row.email.toLowerCase()))

  const filteredEmails: string[] = []
  const filteredSample: { email: string; name: string | null }[] = []
  for (const [email, info] of uniqueByEmail) {
    if (optedOutSet.has(email)) continue
    filteredEmails.push(email)
    if (filteredSample.length < SAMPLE_SIZE) filteredSample.push(info)
  }

  return { emails: filteredEmails, total: filteredEmails.length, sampled: filteredSample }
}

async function fetchCandidates(
  segment: EmailSegment,
): Promise<{ email: string; name: string | null }[]> {
  switch (segment.type) {
    case 'all': {
      const rows = await prisma!.customer.findMany({
        where: { isVerified: true },
        select: { email: true, name: true },
      })
      return rows.map(r => ({ email: r.email, name: r.name || null }))
    }
    case 'paid_recent': {
      const days = Math.max(1, Math.min(365, Math.floor(segment.lastDays)))
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const rows = await prisma!.order.findMany({
        where: {
          paymentStatus: 'paid',
          createdAt: { gte: since },
        },
        select: { customerEmail: true, customerName: true },
        distinct: ['customerEmail'],
      })
      return rows.map(r => ({ email: r.customerEmail, name: r.customerName || null }))
    }
    case 'top_spenders': {
      const limit = Math.max(1, Math.min(500, Math.floor(segment.limit)))
      const grouped = await prisma!.order.groupBy({
        by: ['customerEmail'],
        where: { paymentStatus: 'paid' },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: limit,
      })
      const emails = grouped.map(g => g.customerEmail)
      if (emails.length === 0) return []
      const customers = await prisma!.customer.findMany({
        where: { email: { in: emails } },
        select: { email: true, name: true },
      })
      const nameByEmail = new Map(customers.map(c => [c.email.toLowerCase(), c.name]))
      return emails.map(email => ({
        email,
        name: nameByEmail.get(email.toLowerCase()) || null,
      }))
    }
    case 'has_wishlist': {
      const rows = await prisma!.customer.findMany({
        where: { wishlist: { some: {} } },
        select: { email: true, name: true },
      })
      return rows.map(r => ({ email: r.email, name: r.name || null }))
    }
  }
}
