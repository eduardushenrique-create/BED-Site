import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB } from '@/lib/localDb'

export type AuditEntry = {
  actorEmail: string
  actorRole?: string | null
  action: string
  targetType: string
  targetId?: string | null
  summary?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
}

const auditClient = (): any => (prisma as any)?.auditLog

/**
 * Best-effort audit log writer. Failures are swallowed so a logging error
 * never breaks the underlying admin action.
 */
export async function recordAuditEntry(entry: AuditEntry): Promise<void> {
  if (!entry.actorEmail || !entry.action || !entry.targetType) return

  if (!hasDatabase || !auditClient()) {
    try {
      const db = readDB()
      db.auditLogs = db.auditLogs || []
      db.auditLogs.unshift({
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole || null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId || null,
        summary: entry.summary || null,
        metadata: entry.metadata || null,
        ip: entry.ip || null,
        createdAt: new Date().toISOString(),
      })
      // Keep the local fallback bounded.
      if (db.auditLogs.length > 5000) {
        db.auditLogs = db.auditLogs.slice(0, 5000)
      }
      writeDB(db)
    } catch (error) {
      console.error('[audit-log] localDb write failed:', error)
    }
    return
  }

  try {
    await auditClient().create({
      data: {
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole || null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId || null,
        summary: entry.summary || null,
        metadata: entry.metadata || undefined,
        ip: entry.ip || null,
      },
    })
  } catch (error) {
    console.error('[audit-log] Prisma write failed:', error)
  }
}

export type AuditLogListItem = {
  id: string
  actorEmail: string
  actorRole: string | null
  action: string
  targetType: string
  targetId: string | null
  summary: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export type AuditLogQuery = {
  actor?: string
  action?: string
  targetType?: string
  limit?: number
  offset?: number
}

export async function listAuditLog(query: AuditLogQuery = {}): Promise<{ items: AuditLogListItem[]; total: number }> {
  const limit = Math.min(Math.max(query.limit || 50, 1), 200)
  const offset = Math.max(query.offset || 0, 0)

  if (!hasDatabase || !auditClient()) {
    const db = readDB()
    let items = (db.auditLogs || []) as AuditLogListItem[]
    if (query.actor) items = items.filter(i => i.actorEmail.toLowerCase().includes(query.actor!.toLowerCase()))
    if (query.action) items = items.filter(i => i.action === query.action)
    if (query.targetType) items = items.filter(i => i.targetType === query.targetType)
    return { items: items.slice(offset, offset + limit), total: items.length }
  }

  try {
    const where: any = {}
    if (query.actor) where.actorEmail = { contains: query.actor, mode: 'insensitive' }
    if (query.action) where.action = query.action
    if (query.targetType) where.targetType = query.targetType

    const [records, total] = await Promise.all([
      auditClient().findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      auditClient().count({ where }),
    ])

    const items: AuditLogListItem[] = records.map((r: any) => ({
      id: r.id,
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      summary: r.summary,
      metadata: r.metadata,
      ip: r.ip,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }))

    return { items, total }
  } catch (error) {
    console.error('[audit-log] listAuditLog Prisma failed:', error)
    return { items: [], total: 0 }
  }
}
