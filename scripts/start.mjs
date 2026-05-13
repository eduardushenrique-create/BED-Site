#!/usr/bin/env node
// Startup wrapper: garante que o schema do banco esta sincronizado antes de
// iniciar o Next. Roda em duas tentativas escalonadas:
//
//   1. `prisma migrate deploy` via CLI (caminho normal). Idempotente.
//   2. Se o CLI falhar/nao estiver acessivel, aplica DIRETAMENTE via SQL
//      as migrations conhecidas do redesign do pipeline (orderType e
//      deliveryMethod). Tambem idempotente — checa schema antes.
//
// Resiliente: se TUDO falhar, loga e segue o startup. App sobe usando
// fallback localDb. Nao bloqueia trafego — pedidos antigos continuam
// funcionando enquanto admin destrava manualmente via /admin/sistema/migrations.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const PRISMA_CLI = 'node_modules/prisma/build/index.js'

function runMigrationsCli() {
  return new Promise((resolve) => {
    if (!existsSync(PRISMA_CLI)) {
      console.warn(`[startup] Prisma CLI nao encontrado em ${PRISMA_CLI} — pulando para fallback SQL`)
      resolve(false)
      return
    }
    const proc = spawn('node', [PRISMA_CLI, 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: process.env,
    })
    let resolved = false
    const finish = (ok, label) => {
      if (resolved) return
      resolved = true
      console.log(`[startup] ${label}`)
      resolve(ok)
    }
    proc.on('exit', (code) => finish(code === 0, `prisma migrate deploy exit=${code}`))
    proc.on('error', (err) => finish(false, `prisma migrate deploy erro de processo: ${err?.message || err}`))
  })
}

// Fallback: aplica via SQL direto usando o @prisma/client que JA esta no
// runtime (nao depende do CLI). Cobre as duas migrations recentes que
// mais frequentemente ficaram pendentes em prod. Idempotente.
async function applySqlFallback() {
  let client
  try {
    const mod = await import('@prisma/client')
    const PrismaClient = mod.PrismaClient
    if (!PrismaClient) throw new Error('@prisma/client sem PrismaClient export')
    client = new PrismaClient()
  } catch (err) {
    console.error('[startup-fallback] nao conseguiu carregar @prisma/client:', err?.message || err)
    return
  }

  async function columnExists(table, column) {
    const rows = await client.$queryRawUnsafe(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2
       ) as exists`,
      table,
      column,
    )
    return Boolean(rows?.[0]?.exists)
  }

  // Migration 20260507180000_pipeline_redesign
  try {
    if (!(await columnExists('Order', 'deliveryMethod'))) {
      await client.$executeRawUnsafe(
        `ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'shipping'`,
      )
      await client.$executeRawUnsafe(
        `UPDATE "Order" SET "fulfillmentStatus" = 'pending' WHERE "fulfillmentStatus" = 'em_revisao'`,
      )
      await client.$executeRawUnsafe(
        `UPDATE "Order" SET "fulfillmentStatus" = 'na_fila' WHERE "fulfillmentStatus" = 'aguardando_producao'`,
      )
      console.log('[startup-fallback] migration 20260507180000 aplicada via SQL')
    } else {
      console.log('[startup-fallback] migration 20260507180000 ja aplicada')
    }
  } catch (err) {
    console.error('[startup-fallback] falha em 20260507180000:', err?.message || err)
  }

  // Migration 20260508030000_order_type_persisted
  try {
    if (!(await columnExists('Order', 'orderType'))) {
      await client.$executeRawUnsafe(
        `ALTER TABLE "Order" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'sob_encomenda'`,
      )
      await client.$executeRawUnsafe(
        `UPDATE "Order" o
           SET "orderType" = 'pronta_entrega'
           WHERE NOT EXISTS (
             SELECT 1 FROM "OrderItem" oi
             JOIN "Product" p ON p.id = oi."productId"
             WHERE oi."orderId" = o.id
               AND (p."underOrder" = true OR p."isPersonalizable" = true)
           )`,
      )
      console.log('[startup-fallback] migration 20260508030000 aplicada via SQL')
    } else {
      console.log('[startup-fallback] migration 20260508030000 ja aplicada')
    }
  } catch (err) {
    console.error('[startup-fallback] falha em 20260508030000:', err?.message || err)
  }

  try {
    await client.$disconnect()
  } catch {
    // ignore
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[startup] DATABASE_URL ausente — pulando migrations (modo localDb)')
  } else {
    console.log('[startup] tentando prisma migrate deploy via CLI')
    const cliOk = await runMigrationsCli()
    if (!cliOk) {
      console.warn('[startup] CLI falhou — aplicando fallback SQL inline')
      await applySqlFallback()
    }
  }
  console.log('[startup] iniciando Next.js standalone')
  await import('./../server.js')
}

main().catch((err) => {
  console.error('[startup] falha critica:', err)
  process.exit(1)
})
