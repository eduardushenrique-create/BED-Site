import 'server-only'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB } from '@/lib/localDb'
import type { SessionUser } from '@/lib/auth'

const BOOTSTRAP_ADMIN_EMAIL = 'eduardus.henrique@gmail.com'
const BOOTSTRAP_ADMIN_NAME = 'Eduardus Henrique'
const BOOTSTRAP_ADMIN_ROLE = 'owner'
const BOOTSTRAP_ADMIN_HASH = 'cebb82d82a8e46fe2016faabce185ccc:e6c76b139fc3a07a14f785fb98a4f3652c0fc8acce796d86ee962db510d32dc286ce03fadbc2dbf852740722dd76b1c68cc6d67bbfd91bda3da0eff522663906'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function verifyPassword(password: string, encodedHash: string) {
  const [salt, storedHash] = encodedHash.split(':')
  if (!salt || !storedHash) return false

  const derived = crypto.scryptSync(password, salt, 64)
  const target = Buffer.from(storedHash, 'hex')
  return derived.length === target.length && crypto.timingSafeEqual(derived, target)
}

function matchesBootstrapAdmin(email: string, password: string) {
  return normalizeEmail(email) === BOOTSTRAP_ADMIN_EMAIL && verifyPassword(password, BOOTSTRAP_ADMIN_HASH)
}

export async function authenticateAdminWithPassword(emailInput: string, password: string): Promise<SessionUser | null> {
  const email = normalizeEmail(emailInput)

  if (hasDatabase && prisma?.adminUser) {
    const existing = await prisma.adminUser.findUnique({ where: { email } })

    if (existing && verifyPassword(password, existing.passwordHash)) {
      return {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role as SessionUser['role'],
      }
    }

    if (!existing && matchesBootstrapAdmin(email, password)) {
      const admin = await prisma.adminUser.create({
        data: {
          name: BOOTSTRAP_ADMIN_NAME,
          email: BOOTSTRAP_ADMIN_EMAIL,
          role: BOOTSTRAP_ADMIN_ROLE,
          passwordHash: BOOTSTRAP_ADMIN_HASH,
        },
      })

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role as SessionUser['role'],
      }
    }

    return null
  }

  const db = readDB()
  const existing = db.users.find(user => normalizeEmail(user.email) === email && user.passwordHash)

  if (existing?.passwordHash && verifyPassword(password, existing.passwordHash)) {
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      role: BOOTSTRAP_ADMIN_ROLE as SessionUser['role'],
    }
  }

  if (!matchesBootstrapAdmin(email, password)) return null

  const bootstrapUser = {
    id: existing?.id || `admin_${Date.now()}`,
    name: existing?.name || BOOTSTRAP_ADMIN_NAME,
    email: BOOTSTRAP_ADMIN_EMAIL,
    passwordHash: BOOTSTRAP_ADMIN_HASH,
    isVerified: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (existing) {
    Object.assign(existing, bootstrapUser)
  } else {
    db.users.push(bootstrapUser)
  }
  writeDB(db)

  return {
    id: bootstrapUser.id,
    email: bootstrapUser.email,
    name: bootstrapUser.name,
    role: BOOTSTRAP_ADMIN_ROLE as SessionUser['role'],
  }
}
