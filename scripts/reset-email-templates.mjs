#!/usr/bin/env node
/**
 * Limpa todas as customizações da tabela EmailTemplate, fazendo o sistema
 * voltar a usar os defaults hardcoded em lib/email-templates.ts.
 *
 * Uso:
 *   1) Garanta que DATABASE_URL aponta para o banco que você quer limpar.
 *      Em produção, isso vem do .env de produção (Vercel/Railway/etc).
 *      Localmente, use o .env.local da raiz do projeto.
 *
 *   2) Modo seguro (lista o que seria apagado, sem apagar):
 *        node scripts/reset-email-templates.mjs
 *
 *   3) Modo destrutivo (APAGA TUDO):
 *        node scripts/reset-email-templates.mjs --yes
 *
 *   4) Apagar só um slug específico (preserva os outros):
 *        node scripts/reset-email-templates.mjs --slug=order_shipped --yes
 *
 * Depois de rodar, o próximo e-mail enviado já usa o novo template B&D
 * direto do código. Não precisa redeploy nem restart.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const args = process.argv.slice(2)
const confirm = args.includes('--yes') || args.includes('-y')
const slugArg = args.find((a) => a.startsWith('--slug='))
const onlySlug = slugArg ? slugArg.split('=')[1] : null

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`)
  process.exit(1)
}

function ok(msg) {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`)
}

function warn(msg) {
  console.log(`\x1b[33m⚠ ${msg}\x1b[0m`)
}

function info(msg) {
  console.log(`  ${msg}`)
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    fail('DATABASE_URL não está definida. Carregue o .env apropriado antes de rodar.')
  }

  // Mostra parte do host para o operador confirmar visualmente em qual banco está mexendo,
  // sem expor credenciais.
  let hostHint = '(host desconhecido)'
  try {
    const u = new URL(databaseUrl)
    hostHint = `${u.hostname}${u.pathname}`
  } catch {
    /* ignore */
  }

  console.log('')
  console.log(`Banco alvo:  \x1b[36m${hostHint}\x1b[0m`)
  console.log(`Filtro slug: ${onlySlug ? `\x1b[36m${onlySlug}\x1b[0m` : '(todos)'}`)
  console.log(`Modo:        ${confirm ? '\x1b[31mDESTRUTIVO\x1b[0m' : '\x1b[33mDRY-RUN (sem apagar)\x1b[0m'}`)
  console.log('')

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) })

  try {
    const where = onlySlug ? { slug: onlySlug } : {}
    const overrides = await prisma.emailTemplate.findMany({
      where,
      select: { slug: true, subject: true, isActive: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    })

    if (overrides.length === 0) {
      ok('Nenhum override encontrado no banco. Os templates já estão usando o default do código.')
      return
    }

    console.log(`Encontrados \x1b[1m${overrides.length}\x1b[0m override(s):`)
    console.log('')
    for (const row of overrides) {
      const status = row.isActive ? '\x1b[32mativo\x1b[0m' : '\x1b[90minativo\x1b[0m'
      const updated = row.updatedAt.toISOString().slice(0, 16).replace('T', ' ')
      info(`• ${row.slug.padEnd(28)} ${status.padEnd(20)} (atualizado em ${updated})`)
      info(`    subject: ${row.subject.slice(0, 80)}${row.subject.length > 80 ? '…' : ''}`)
    }
    console.log('')

    if (!confirm) {
      warn('Dry-run: nada foi apagado.')
      info('Para apagar de verdade, rode novamente com --yes:')
      info(`  node scripts/reset-email-templates.mjs ${onlySlug ? `--slug=${onlySlug} ` : ''}--yes`)
      return
    }

    const result = await prisma.emailTemplate.deleteMany({ where })
    ok(`${result.count} override(s) apagado(s).`)
    info('Próximos e-mails já vão usar o template novo direto do código (sem redeploy).')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('')
  fail(`Erro: ${err.message}`)
})
