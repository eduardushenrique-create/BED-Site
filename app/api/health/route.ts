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
  }
  missingColumns?: string[]
  error?: string
  timestamp: string
}

export async function GET() {
  const report: HealthReport = {
    status: 'ok',
    checks: { prisma: 'down', schema: 'skipped', order_query: 'skipped' },
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

  // 3) Query simples através do client (pega mismatches que o information_schema
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
