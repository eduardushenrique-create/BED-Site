import 'server-only'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB } from '@/lib/localDb'
import type { SessionUser } from '@/lib/auth'

// A6 — o bootstrap do admin "owner" vem de variáveis de ambiente (secret FORA
// do código-fonte). Sem BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD_HASH
// configurados, o bootstrap fica DESABILITADO — não há conta-backdoor embutida
// no repositório. O fluxo normal de login via AdminUser no banco é inalterado.
const BOOTSTRAP_ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase()
const BOOTSTRAP_ADMIN_NAME = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Admin'
const BOOTSTRAP_ADMIN_ROLE = process.env.BOOTSTRAP_ADMIN_ROLE?.trim() || 'owner'
const BOOTSTRAP_ADMIN_HASH = (process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH || '').trim()

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

function bootstrapConfigured() {
  return Boolean(BOOTSTRAP_ADMIN_EMAIL && BOOTSTRAP_ADMIN_HASH)
}

function matchesBootstrapAdmin(email: string, password: string) {
  // Desabilitado quando as envs de bootstrap não estão configuradas (A6) —
  // sem fallback hardcoded.
  if (!bootstrapConfigured()) return false
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
