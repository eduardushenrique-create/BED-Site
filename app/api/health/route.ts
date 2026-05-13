import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Healthcheck público: detecta os cenários que causaram o incidente de
 * 2026-05-13 (Prisma client desligado do schema do banco) antes que eles
 * apareçam para o usuário final.
 *
 * Status:
 * - 200: tudo OK.
 * - 503: Prisma indisponível, ou colunas esperadas pelo client não existem
 *   no banco (migration pendente), ou queries simples falham.
 *
 * Não requer auth — propositalmente, para que Railway/UptimeRobot/etc.
 * possam pollar. Resposta NÃO expõe segredos: só nomes de colunas e
 * mensagens de erro de schema. Sem dados de usuário.
 */

// Colunas obrigatórias que o Prisma client compilado espera encontrar na
// tabela "Order". Se alguma faltar, indica migration pendente — exatamente
// o sintoma de "column X.discountReason does not exist" que derrubou tudo
// em 2026-05-13.
const REQUIRED_ORDER_COLUMNS = [
  'id',
  'orderNumber',
  'customerName',
  'customerEmail',
  'status',
  'paymentStatus',
  'fulfillmentStatus',
  'subtotal',
  'discountTotal',
  'discountReason',
  'shippingTotal',
  'total',
  'deliveryMethod',
  'orderType',
  'productionTimeline',
  'currentStageNote',
  'createdAt',
  'updatedAt',
] as const

type HealthReport = {
  status: 'ok' | 'degraded'
  checks: {
    prisma: 'up' | 'down'
    schema: 'ok' | 'mismatch' | 'unreachable' | 'skipped'
    order_query: 'ok' | 'failed' | 'skipped'
    migrations: 'ok' | 'mismatch' | 'unreachable' | 'skipped'
  }
  missingColumns?: string[]
  migrationsIssues?: Array<{ migration_name: string; issue: string }>
  error?: string
  timestamp: string
}

export async function GET() {
  const report: HealthReport = {
    status: 'ok',
    checks: {
      prisma: 'down',
      schema: 'skipped',
      order_query: 'skipped',
      migrations: 'skipped',
    },
    timestamp: new Date().toISOString(),
  }

  // 1) Prisma client foi inicializado?
  if (!prisma?.order) {
    report.status = 'degraded'
    report.error = 'Prisma client indisponível (DATABASE_URL ausente?)'
    return NextResponse.json(report, { status: 503 })
  }
  report.checks.prisma = 'up'

  // 2) Schema do banco bate com o que o client espera?
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Order'`,
    )
    const existing = new Set(rows.map(r => r.column_name))
    const missing = REQUIRED_ORDER_COLUMNS.filter(c => !existing.has(c))
    if (missing.length > 0) {
      report.status = 'degraded'
      report.checks.schema = 'mismatch'
      report.missingColumns = missing
      report.error = `Schema do banco está atrás do Prisma client. Colunas faltando: ${missing.join(', ')}. Migration pendente.`
      return NextResponse.json(report, { status: 503 })
    }
    report.checks.schema = 'ok'
  } catch (err) {
    report.status = 'degraded'
    report.checks.schema = 'unreachable'
    report.error = err instanceof Error ? err.message : String(err)
    return NextResponse.json(report, { status: 503 })
  }

  // 3) Migrations: alguma falhou ou está em estado de checksum mismatch?
  //    Olhamos a tabela _prisma_migrations diretamente — o status que
  //    `prisma migrate status` exporia, mas sem rodar o CLI.
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >(
      `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 20`,
    )
    const issues: Array<{ migration_name: string; issue: string }> = []
    for (const m of rows) {
      if (m.rolled_back_at) {
        issues.push({ migration_name: m.migration_name, issue: 'rolled_back' })
      } else if (!m.finished_at) {
        issues.push({ migration_name: m.migration_name, issue: 'unfinished' })
      }
    }
    if (issues.length > 0) {
      report.status = 'degraded'
      report.checks.migrations = 'mismatch'
      report.migrationsIssues = issues
      report.error = `Há migrations em estado inválido: ${issues.map(i => `${i.migration_name}=${i.issue}`).join(', ')}.`
      return NextResponse.json(report, { status: 503 })
    }
    report.checks.migrations = 'ok'
  } catch (err) {
    report.status = 'degraded'
    report.checks.migrations = 'unreachable'
    report.error = err instanceof Error ? err.message : String(err)
    return NextResponse.json(report, { status: 503 })
  }

  // 4) Query simples através do client (pega mismatches que o information_schema
  //    não detecta, como tipos divergentes).
  try {
    await prisma.order.count()
    report.checks.order_query = 'ok'
  } catch (err) {
    report.status = 'degraded'
    report.checks.order_query = 'failed'
    report.error = err instanceof Error ? err.message : String(err)
    return NextResponse.json(report, { status: 503 })
  }

  return NextResponse.json(report, { status: 200 })
}
