#!/usr/bin/env node
// Startup wrapper. Em produção, garante que o schema do banco está em dia
// antes de abrir tráfego — caso contrário, app NÃO sobe.
//
// Mudança de filosofia pós-incidente 2026-05-13:
//   Antes: se prisma migrate deploy falhar, aplica fallback SQL hardcoded
//          de 2 migrations específicas e segue. Migrations novas ficavam
//          pendentes silenciosamente, e o app subia com Prisma client
//          dessincronizado do banco, mascarando erros como "lista de
//          pedidos vazia".
//   Agora: tenta prisma migrate deploy com retry. Se ainda falhar em
//          produção, exit(1) — Railway reinicia, equipe vê o problema
//          imediatamente em vez de descobrir horas depois pelo usuário.
//
// O fallback SQL hardcoded foi REMOVIDO porque era a causa raiz do
// incidente — só conhecia 2 migrations específicas, deixava as novas
// pendentes em silêncio. Não tinha como adaptar; melhor falhar.
//
// Pré-requisito: o Dockerfile precisa copiar /app/node_modules inteiro
// (não só prisma/ e @prisma/), senão o CLI explode com
// "Cannot find module 'effect'". Fixado em PR #136.
//
// Dev/local: sem DATABASE_URL ou com migrate falhando, segue rodando em
// modo localDb. Não bloqueia o desenvolvimento.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const PRISMA_CLI = 'node_modules/prisma/build/index.js'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

function runMigrationsOnce() {
  return new Promise((resolve) => {
    if (!existsSync(PRISMA_CLI)) {
      console.error(`[startup] Prisma CLI nao encontrado em ${PRISMA_CLI}`)
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
    proc.on('error', (err) =>
      finish(false, `prisma migrate deploy erro de processo: ${err?.message || err}`),
    )
  })
}

async function runMigrationsWithRetry() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[startup] migrate deploy tentativa ${attempt}/${MAX_RETRIES}`)
    const ok = await runMigrationsOnce()
    if (ok) return true
    if (attempt < MAX_RETRIES) {
      console.log(`[startup] retry em ${RETRY_DELAY_MS}ms...`)
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    }
  }
  return false
}

async function main() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (!process.env.DATABASE_URL) {
    if (isProduction) {
      console.error('[startup] FATAL: NODE_ENV=production sem DATABASE_URL — abortando.')
      process.exit(1)
    }
    console.warn('[startup] DATABASE_URL ausente — modo localDb (apenas dev)')
    console.log('[startup] iniciando Next.js standalone')
    await import('./../server.js')
    return
  }

  console.log('[startup] aplicando migrations via prisma migrate deploy')
  const ok = await runMigrationsWithRetry()

  if (!ok) {
    if (isProduction) {
      console.error('[startup] FATAL: migrations nao aplicadas apos retries. App nao vai subir.')
      console.error('[startup] verifique conectividade do Postgres e estado de _prisma_migrations.')
      console.error('[startup] em ultimo caso, aplique a migration pendente via Railway → Postgres → Query.')
      process.exit(1)
    }
    console.warn('[startup] migrate deploy falhou em dev — seguindo mesmo assim com schema potencialmente atrasado')
  }

  console.log('[startup] iniciando Next.js standalone')
  await import('./../server.js')
}

main().catch((err) => {
  console.error('[startup] falha critica:', err)
  process.exit(1)
})
