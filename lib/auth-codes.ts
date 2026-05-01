import 'server-only'

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { getCodePepper } from '@/lib/session-token'

const CODE_TTL_MS = 10 * 60 * 1000
const DB_PATH = path.join(process.cwd(), 'data', 'auth-codes.json')

type StoredCode = {
  id: string
  email: string
  codeHash: string
  expiresAt: string
  usedAt: string | null
  attempts: number
  ipHash: string
  createdAt: string
}

type AuthCodeDb = {
  codes: StoredCode[]
  rateLimits: Record<string, { count: number; resetAt: string }>
}

function readStore(): AuthCodeDb {
  if (!fs.existsSync(DB_PATH)) return { codes: [], rateLimits: {} }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as AuthCodeDb
  } catch {
    return { codes: [], rateLimits: {} }
  }
}

function writeStore(store: AuthCodeDb) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2))
}

function hash(value: string) {
  return crypto.createHash('sha256').update(`${value}:${getCodePepper()}`).digest('hex')
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function assertRateLimit(email: string, ip: string) {
  const store = readStore()
  const now = Date.now()
  const key = hash(`${normalizeEmail(email)}:${ip}`)
  const current = store.rateLimits[key]

  if (current && new Date(current.resetAt).getTime() > now && current.count >= 5) {
    throw new Error('Muitas tentativas. Aguarde alguns minutos antes de pedir outro código.')
  }

  store.rateLimits[key] = current && new Date(current.resetAt).getTime() > now
    ? { ...current, count: current.count + 1 }
    : { count: 1, resetAt: new Date(now + 15 * 60 * 1000).toISOString() }

  writeStore(store)
}

export function generateAccessCode() {
  return crypto.randomInt(100000, 999999).toString()
}

export async function storeAccessCode(emailInput: string, code: string, ip: string) {
  const email = normalizeEmail(emailInput)
  assertRateLimit(email, ip)

  if (hasDatabase && prisma?.authCode) {
    await prisma.authCode.create({
      data: {
        email,
        codeHash: hash(code),
        ipHash: hash(ip),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    })
    return
  }

  const store = readStore()
  store.codes = store.codes
    .filter(item => new Date(item.expiresAt).getTime() > Date.now() && !item.usedAt)
    .concat({
      id: crypto.randomUUID(),
      email,
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      usedAt: null,
      attempts: 0,
      ipHash: hash(ip),
      createdAt: new Date().toISOString(),
    })
  writeStore(store)
}

export async function consumeAccessCode(emailInput: string, code: string) {
  const email = normalizeEmail(emailInput)
  const codeHash = hash(code)

  if (hasDatabase && prisma?.authCode) {
    const stored = await prisma.authCode.findFirst({
      where: {
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!stored || stored.codeHash !== codeHash || stored.attempts >= 5) {
      if (stored) {
        await prisma.authCode.update({ where: { id: stored.id }, data: { attempts: { increment: 1 } } })
      }
      return false
    }

    await prisma.authCode.update({ where: { id: stored.id }, data: { usedAt: new Date() } })
    return true
  }

  const store = readStore()
  const stored = [...store.codes].reverse().find(item =>
    item.email === email &&
    !item.usedAt &&
    new Date(item.expiresAt).getTime() > Date.now()
  )

  if (!stored || stored.codeHash !== codeHash || stored.attempts >= 5) {
    if (stored) stored.attempts += 1
    writeStore(store)
    return false
  }

  stored.usedAt = new Date().toISOString()
  writeStore(store)
  return true
}
