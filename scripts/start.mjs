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
//
// NUNCA adicionar aqui o user do Postgres do CI ('smoke'). Ele é DB real
// (efemero, mas real) — boot smoke precisa que start.mjs valide schema
// de fato, senao o teste de regressao da migration `rolled_back` (que
// derrubou prod no PR #153) nao testa nada.
const DUMMY_DB_PATTERNS = [
  /:\/\/dummy:dummy@/i,
  /:\/\/johndoe:randompassword@/i,
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
    `SELECT migration_name, started_at, finished_at, rolled_back_at
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

    // Migrations efetivamente aplicadas e validas: tem finished_at e nao
    // foram revertidas. Migrations `rolled_back` foram revertidas
    // PROPOSITALMENTE (via `prisma migrate resolve --rolled-back`) e nao
    // contam como aplicadas, mas tambem NAO sao bloqueadoras.
    const appliedOk = new Set(
      applied.filter((m) => m.finished_at && !m.rolled_back_at).map((m) => m.migration_name),
    )

    // CRITICO: migration esta no disco mas nao foi aplicada com sucesso
    // no banco. Causou o incidente da manha de 2026-05-13 (Prisma client
    // espera coluna inexistente). Aborta boot em prod.
    const missing = local.filter((m) => !appliedOk.has(m))

    // CRITICO: migration travou no meio (started_at sem finished_at e
    // sem rolled_back_at). Estado invalido — alguem precisa investigar.
    const unfinished = applied
      .filter((m) => m.started_at && !m.finished_at && !m.rolled_back_at)
      .map((m) => m.migration_name)

    // INFORMATIVO: migration foi revertida intencionalmente. NAO eh erro
    // — pode ter sido descartada deliberadamente (ex: a
    // 20260430210000_init_railway_postgres do Railway). Apenas log.
    // Vide feedback_rolled_back_migration_nao_eh_erro.md.
    const rolledBack = applied
      .filter((m) => m.rolled_back_at)
      .map((m) => m.migration_name)

    return { local, applied: [...appliedOk], missing, unfinished, rolledBack }
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
      const { local, applied, missing, unfinished, rolledBack } = await validateSchema()
      console.log(
        `[startup] schema check: ${applied.length}/${local.length} migrations aplicadas`,
      )

      // Migrations rolled_back sao informativo, nao erro. Vide
      // feedback_rolled_back_migration_nao_eh_erro.md (PR-5b derrubou
      // prod por 18min em 2026-05-14 abortando indevidamente nelas).
      if (rolledBack.length > 0) {
        console.log(
          `[startup] info: ${rolledBack.length} migration(s) revertida(s) intencionalmente (rolled_back): ${rolledBack.join(', ')}`,
        )
      }

      let abort = false

      if (missing.length > 0) {
        console.error(
          `[startup] FAIL: ${missing.length} migration(s) no disco nao aplicada(s): ${missing.join(', ')}`,
        )
        abort = isProd
      }

      if (unfinished.length > 0) {
        console.error(
          `[startup] FAIL: ${unfinished.length} migration(s) com started_at mas sem finished_at (travada): ${unfinished.join(', ')}`,
        )
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
      } else if (missing.length > 0 || unfinished.length > 0) {
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
