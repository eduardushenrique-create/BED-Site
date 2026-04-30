import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaPool: Pool | undefined
}

const connectionString = process.env.DATABASE_URL || 'postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public'
const pool = globalForPrisma.prismaPool ?? new Pool({ connectionString })
const adapter = new PrismaPg(pool)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaPool = pool
}

export default prisma
