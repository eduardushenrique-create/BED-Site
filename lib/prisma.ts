import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const databaseUrl = process.env.DATABASE_URL || ''
const hasValidDb = Boolean(databaseUrl && !databaseUrl.includes('johndoe:randompassword'))

let prisma: PrismaClient | null = null

if (hasValidDb) {
  try {
    prisma = globalForPrisma.prisma ?? new PrismaClient({
      adapter: new PrismaPg(databaseUrl),
    })

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prisma
    }
  } catch (error) {
    console.warn('[prisma] failed to initialize client:', error)
    prisma = null
  }
}

export default prisma
