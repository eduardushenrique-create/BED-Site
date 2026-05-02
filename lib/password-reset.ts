import 'server-only'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB } from '@/lib/localDb'

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const SCRYPT_KEY_LENGTH = 64

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  return `${salt}:${derived.toString('hex')}`
}

export type AdminLookup = {
  id: string
  email: string
  name: string
}

export async function findAdminUserByEmail(emailInput: string): Promise<AdminLookup | null> {
  const email = normalizeEmail(emailInput)
  if (!email) return null

  if (hasDatabase && prisma?.adminUser) {
    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (!admin) return null
    return { id: admin.id, email: admin.email, name: admin.name }
  }

  const db = readDB()
  const user = db.users.find(u => normalizeEmail(u.email) === email && u.passwordHash)
  if (!user) return null
  return { id: user.id, email: user.email, name: user.name }
}

export async function createPasswordResetToken(adminUserId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

  if (hasDatabase && (prisma as any)?.passwordResetToken) {
    // Invalidate any previous unused tokens for this admin (defense-in-depth).
    await (prisma as any).passwordResetToken.updateMany({
      where: { adminUserId, usedAt: null },
      data: { usedAt: new Date() },
    })
    await (prisma as any).passwordResetToken.create({
      data: { adminUserId, tokenHash, expiresAt },
    })
    return rawToken
  }

  const db = readDB()
  db.passwordResetTokens = db.passwordResetTokens || []
  for (const t of db.passwordResetTokens) {
    if (t.adminUserId === adminUserId && !t.usedAt) {
      t.usedAt = new Date().toISOString()
    }
  }
  db.passwordResetTokens.push({
    id: `pwreset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    adminUserId,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  })
  writeDB(db)
  return rawToken
}

export async function consumePasswordResetTokenAndSetPassword(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: 'invalid_token' | 'expired' | 'used' | 'admin_not_found' }> {
  const tokenHash = hashToken(rawToken)
  const newHash = hashPassword(newPassword)
  const now = new Date()

  if (hasDatabase && (prisma as any)?.passwordResetToken) {
    const record = await (prisma as any).passwordResetToken.findUnique({ where: { tokenHash } })
    if (!record) return { ok: false, error: 'invalid_token' }
    if (record.usedAt) return { ok: false, error: 'used' }
    if (record.expiresAt instanceof Date ? record.expiresAt < now : new Date(record.expiresAt) < now) {
      return { ok: false, error: 'expired' }
    }

    // Update password and mark token used in a single transaction.
    try {
      await prisma!.$transaction([
        prisma!.adminUser.update({
          where: { id: record.adminUserId },
          data: { passwordHash: newHash },
        }),
        (prisma as any).passwordResetToken.update({
          where: { id: record.id },
          data: { usedAt: now },
        }),
      ])
      return { ok: true }
    } catch (error) {
      console.error('[password-reset] transaction failed:', error)
      return { ok: false, error: 'admin_not_found' }
    }
  }

  const db = readDB()
  const record = (db.passwordResetTokens || []).find(t => t.tokenHash === tokenHash)
  if (!record) return { ok: false, error: 'invalid_token' }
  if (record.usedAt) return { ok: false, error: 'used' }
  if (new Date(record.expiresAt) < now) return { ok: false, error: 'expired' }

  const user = db.users.find(u => u.id === record.adminUserId)
  if (!user) return { ok: false, error: 'admin_not_found' }

  user.passwordHash = newHash
  user.updatedAt = now.toISOString()
  record.usedAt = now.toISOString()
  writeDB(db)
  return { ok: true }
}

export function isStrongEnoughPassword(password: string): boolean {
  if (typeof password !== 'string') return false
  if (password.length < 8) return false
  // Pelo menos uma letra e um número, sem regra de case (admin pode escolher).
  return /[A-Za-z]/.test(password) && /\d/.test(password)
}
