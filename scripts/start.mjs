#!/usr/bin/env node
// Startup wrapper: valida se o schema do Postgres esta sincronizado com as
// migrations do repositorio antes de subir o Next. NAO aplica migrations
// (isso e feito pelo .github/workflows/migrate.yml, conforme ADR-002).
//
// Comportamento por ambiente:
//
//   - Producao (NODE_ENV=production + DATABASE_URL real):
//       Le _prisma_migrations no banco e compara com prisma/migrations/.
//       Se houver migration faltando, FAIL-FAST (exit 1). O Railway vai
//       reiniciar o container algumas vezes — eventualmente o
//       migrate.yml termina e o boot subsequente encontra o schema OK.
//
//   - Build do Docker (DATABASE_URL = dummy):
//       Pula validacao. So `next build` precisa rodar.
//
//   - Dev/CI/sem DATABASE_URL:
//       Pula validacao. Apps em modo localDb continuam funcionando.

import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations')

function isDummyDatabaseUrl(url) {
  if (!url) return true
  // Dummies conhecidos: builder do Dockerfile e CI do GitHub.
  return /:\/\/(dummy|johndoe):/i.test(url)
}

function listLocalMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return []
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

async function listAppliedMigrations(client) {
  const rows = await client.$queryRawUnsafe(
    `SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY started_at`,
  )
  return rows.map((r) => r.migration_name)
}

async function validateSchema() {
  let client
  try {
    const mod = await import('@prisma/client')
    const PrismaClient = mod.PrismaClient
    if (!PrismaClient) throw new Error('@prisma/client sem PrismaClient export')
    client = new PrismaClient()
  } catch (err) {
    throw new Error(`nao foi possivel carregar @prisma/client: ${err?.message || err}`)
  }

  try {
    const local = listLocalMigrations()
    const applied = await listAppliedMigrations(client)
    const missing = local.filter((m) => !applied.includes(m))
    return { local, applied, missing }
  } finally {
    await client.$disconnect().catch(() => {})
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  const isProd = process.env.NODE_ENV === 'production'

  if (!url || isDummyDatabaseUrl(url)) {
    console.log('[startup] DATABASE_URL ausente ou dummy — pulando validacao de schema (modo dev/build)')
  } else {
    try {
      const { local, applied, missing } = await validateSchema()
      console.log(
        `[startup] schema check: ${applied.length}/${local.length} migrations aplicadas`,
      )

      if (missing.length > 0) {
        console.error(
          `[startup] FAIL: ${missing.length} migration(s) faltando: ${missing.join(', ')}`,
        )
        if (isProd) {
          console.error(
            '[startup] abortando boot em producao — o GitHub Action ' +
              '(.github/workflows/migrate.yml) deveria ter aplicado essas ' +
              'migrations antes do deploy. Veja https://github.com/' +
              'eduardushenrique-create/BED-Site/actions/workflows/migrate.yml',
          )
          process.exit(1)
        } else {
          console.warn(
            '[startup] continuando em modo nao-producao (NODE_ENV != production)',
          )
        }
      }
    } catch (err) {
      console.error('[startup] falha ao validar schema:', err?.message || err)
      if (isProd) {
        console.error('[startup] abortando boot em producao')
        process.exit(1)
      }
    }
  }

  console.log('[startup] iniciando Next.js standalone')
  await import('./../server.js')
}

main().catch((err) => {
  console.error('[startup] falha critica:', err)
  process.exit(1)
})
