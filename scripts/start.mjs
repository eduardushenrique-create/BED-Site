#!/usr/bin/env node
// Startup wrapper: roda prisma migrate deploy ANTES de iniciar o Next.
//
// Migrations sao idempotentes (Prisma checa _prisma_migrations e pula as ja
// aplicadas), entao rodar a cada startup eh seguro. Se nao houver
// DATABASE_URL configurado (env de dev local sem banco), o `migrate deploy`
// falha rapido — log warning e seguimos em frente para o app subir usando
// fallback localDb.
//
// Antes desta config, migrations precisavam ser rodadas manualmente via
// `railway run npx prisma migrate deploy`. Em janelas de tempo entre push e
// migrate manual, o Prisma client esperava colunas que ainda nao existiam
// no banco — INSERTS falhavam, fallbacks corrompiam dados, bugs invisiveis.

import { spawn } from 'node:child_process'

function runMigrations() {
  return new Promise((resolve) => {
    const proc = spawn('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: process.env,
    })
    let resolved = false
    const finish = (label) => {
      if (resolved) return
      resolved = true
      console.log(`[startup] ${label}`)
      resolve()
    }
    proc.on('exit', (code) => {
      if (code === 0) finish('prisma migrate deploy: OK')
      else finish(`prisma migrate deploy returned exit ${code} — continuando mesmo assim`)
    })
    proc.on('error', (err) => {
      finish(`prisma migrate deploy nao iniciou: ${err?.message || err} — continuando`)
    })
  })
}

async function main() {
  if (process.env.DATABASE_URL) {
    console.log('[startup] DATABASE_URL detectado — rodando prisma migrate deploy')
    await runMigrations()
  } else {
    console.log('[startup] DATABASE_URL ausente — pulando migrations (modo localDb)')
  }
  console.log('[startup] iniciando Next.js standalone')
  await import('./../server.js')
}

main().catch((err) => {
  console.error('[startup] falha critica:', err)
  process.exit(1)
})
