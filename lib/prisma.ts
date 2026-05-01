/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const globalForPrisma = globalThis as unknown as {
  prisma: any
  prismaPool?: any
}

const databaseUrl = process.env.DATABASE_URL || ''
const hasValidDb = Boolean(databaseUrl && !databaseUrl.includes('johndoe:randompassword'))

let prisma: any = null

if (hasValidDb) {
  try {
    const { PrismaClient } = require('@prisma/client')
    const { PrismaPg } = require('@prisma/adapter-pg')
    const { Pool } = require('pg')

    const pool = globalForPrisma.prismaPool ?? new Pool({ connectionString: databaseUrl })
    const adapter = new PrismaPg(pool)
    prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prisma
      globalForPrisma.prismaPool = pool
    }
  } catch {
    console.warn('Prisma not available, using mock fallback')
    prisma = null
  }
}

export default prisma
