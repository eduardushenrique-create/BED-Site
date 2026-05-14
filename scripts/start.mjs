#!/usr/bin/env node
//
// Startup wrapper. APENAS valida sincronização entre as migrations do
// repositorio e o estado do Postgres. NAO aplica migrations (isso eh
// feito por .github/workflows/migrate.yml, conforme ADR-002).
//
// Implementacao usa `pg` direto em vez de PrismaClient porque o
// PrismaClient do Prisma 7 exige `adapter: new PrismaPg(...)` e introduz
// uma camada extra de coisas que podem dar errado no boot. `pg` eh
// minimal, dependencia direta, validado por boot smoke test em CI.
//
// Comportamento por ambiente:
//
//   - Producao (NODE_ENV=production + DATABASE_URL real):
//       Le _prisma_migrations no banco e compara com prisma/migrations/.
//       Se houver migration faltando ou em estado invalido (rolled_back,
//       unfinished), FAIL-FAST (exit 1). Container sera reiniciado pelo
//       Railway. Eventualmente o GitHub Action de migrations termina ou
//       admin aplica via SQL — proximo restart sobe.
//
//   - Build do Docker (DATABASE_URL = dummy):
//       Pula validacao silenciosamente. So `next build` roda.
//
//   - Dev/CI/sem DATABASE_URL:
//       Pula validacao. Modo localDb continua funcionando.

import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations')

// Dummies conhecidos: builder do Dockerfile e CI do GitHub.
// Listados explicitamente — adicionar aqui se introduzir outro padrão.
const DUMMY_DB_PATTERNS = [
  /:\/\/dummy:dummy@/i,
  /:\/\/johndoe:randompassword@/i,
  /:\/\/smoke:smoke@/i,
]

function isDummyDatabaseUrl(url) {
  if (!url) return true
  return DUMMY_DB_PATTERNS.some((re) => re.test(url))
}

function listLocalMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return []
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

async function loadPgClient() {
  // `pg` eh dep direta (vide package.json). Importacao dinamica para nao
  // quebrar o boot em ambientes que nao tem pg instalado (improvavel mas
  // defensivo).
  try {
    const mod = await import('pg')
    return mod.default?.Client || mod.Client
  } catch (err) {
    throw new Error(
      `nao foi possivel carregar 'pg': ${err?.message || err}. ` +
        'Confirme que node_modules/pg foi copiado pro runner image.',
    )
  }
}

async function listAppliedMigrations(client) {
  const res = await client.query(
    `SELECT migration_name, finished_at, rolled_back_at
       FROM "_prisma_migrations"
      ORDER BY started_at`,
  )
  return res.rows
}

async function validateSchema() {
  const Client = await loadPgClient()
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const local = listLocalMigrations()
    const applied = await listAppliedMigrations(client)
    const appliedOk = new Set(
      applied.filter((m) => m.finished_at && !m.rolled_back_at).map((m) => m.migration_name),
    )
    const issues = applied
      .filter((m) => m.rolled_back_at || !m.finished_at)
      .map((m) => ({
        migration_name: m.migration_name,
        issue: m.rolled_back_at ? 'rolled_back' : 'unfinished',
      }))
    const missing = local.filter((m) => !appliedOk.has(m))
    return { local, applied: [...appliedOk], missing, issues }
  } finally {
    await client.end().catch(() => {})
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  const isProd = process.env.NODE_ENV === 'production'

  if (!url || isDummyDatabaseUrl(url)) {
    console.log('[startup] DATABASE_URL ausente ou dummy — pulando validacao de schema (modo dev/build)')
  } else {
    try {
      const { local, applied, missing, issues } = await validateSchema()
      console.log(
        `[startup] schema check: ${applied.length}/${local.length} migrations aplicadas`,
      )

      let abort = false

      if (missing.length > 0) {
        console.error(
          `[startup] FAIL: ${missing.length} migration(s) faltando: ${missing.join(', ')}`,
        )
        abort = isProd
      }

      if (issues.length > 0) {
        const desc = issues.map((i) => `${i.migration_name}=${i.issue}`).join(', ')
        console.error(`[startup] FAIL: migrations em estado invalido: ${desc}`)
        abort = isProd
      }

      if (abort) {
        console.error(
          '[startup] abortando boot em producao — o GitHub Action ' +
            '(.github/workflows/migrate.yml) deveria ter aplicado/regularizado ' +
            'essas migrations antes do deploy. Veja https://github.com/' +
            'eduardushenrique-create/BED-Site/actions/workflows/migrate.yml',
        )
        process.exit(1)
      } else if (missing.length > 0 || issues.length > 0) {
        console.warn(
          '[startup] continuando em modo nao-producao (NODE_ENV != production)',
        )
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
