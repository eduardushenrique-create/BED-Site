import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB } from '@/lib/localDb'
import type { AuthRole, SessionUser } from '@/lib/auth'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function envList(name: string) {
  return (process.env[name] || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

function roleForEmail(email: string): AuthRole {
  const normalized = normalizeEmail(email)
  if (envList('OWNER_EMAILS').includes(normalized)) return 'owner'
  if (envList('ADMIN_EMAILS').includes(normalized)) return 'admin'
  return 'customer'
}

export async function findOrCreateSessionUser(emailInput: string, nameInput?: string): Promise<SessionUser> {
  const email = normalizeEmail(emailInput)
  const name = nameInput?.trim() || email.split('@')[0]

  if (hasDatabase && prisma) {
    const admin = prisma.adminUser
      ? await prisma.adminUser.findUnique({ where: { email } })
      : null

    if (admin) {
      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role as AuthRole,
      }
    }

    const customer = await prisma.customer.upsert({
      where: { email },
      update: { name, isVerified: true },
      create: { email, name, isVerified: true },
    })

    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      role: roleForEmail(email),
    }
  }

  const db = readDB()
  let user = db.users.find(item => item.email.toLowerCase() === email)
  if (!user) {
    user = {
      id: `user_${Date.now()}`,
      name,
      email,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.users.push(user)
  } else {
    user.isVerified = true
    user.name = user.name || name
    user.updatedAt = new Date().toISOString()
  }
  writeDB(db)

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: roleForEmail(email),
  }
}
