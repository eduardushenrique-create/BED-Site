import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { dispatchCampaignInBackground } from '@/lib/email-dispatcher'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'cron.email-campaigns' })

export const dynamic = 'force-dynamic'

/**
 * Cron handler — busca campanhas com status='scheduled' cujo scheduledAt
 * já passou e dispara cada uma em background. Idempotente: o dispatcher
 * só aceita transições draft|scheduled → sending, então re-rodar o cron
 * antes do dispatch terminar não causa envio duplo.
 *
 * Autenticação:
 *   - Header `Authorization: Bearer <CRON_SECRET>`, OU
 *   - Header `X-Cron-Secret: <CRON_SECRET>` (cron services antigos)
 *
 * Sem CRON_SECRET configurado: retorna 503. NÃO usamos fail-open aqui
 * (diferente dos webhooks de provedores) porque cron pode disparar
 * envio em massa real — segurança vem antes da conveniência.
 *
 * Configuração esperada:
 *   - Railway Cron Service: \`* * * * *\` apontando pra
 *     POST https://app.beddesigns.com.br/api/cron/email-campaigns
 *     com header Authorization: Bearer <CRON_SECRET>
 *   - Frequência mínima útil: 1 min. Máxima razoável: 5 min.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    request.headers.get('x-cron-secret')?.trim() ||
    ''
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!hasDatabase || !prisma?.emailCampaign) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 503 })
  }

  try {
    const due = await prisma.emailCampaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, name: true },
      orderBy: { scheduledAt: 'asc' },
      take: 25, // limite por tick — evita cascata se muitas atrasadas de uma vez
    })

    if (due.length === 0) {
      return NextResponse.json({ found: 0, dispatched: 0 })
    }

    let dispatched = 0
    for (const campaign of due) {
      try {
        // Marca como 'sending' ANTES de chamar o dispatcher pra ganhar
        // exclusão mútua entre ticks paralelos (cron + click manual).
        // Se outro processo já transicionou, updateMany retorna count=0
        // e pulamos.
        const claim = await prisma.emailCampaign.updateMany({
          where: { id: campaign.id, status: 'scheduled' },
          data: { status: 'sending', startedAt: new Date() },
        })
        if (claim.count === 0) continue

        dispatchCampaignInBackground(campaign.id, appUrl)
        dispatched += 1
        log.info({ campaignId: campaign.id, name: campaign.name }, 'campaign claimed by cron')
      } catch (error) {
        captureException(error, {
          context: 'cron.email-campaigns',
          detail: 'claim or dispatch failed',
          campaignId: campaign.id,
        })
      }
    }

    return NextResponse.json({ found: due.length, dispatched })
  } catch (error) {
    captureException(error, { context: 'cron.email-campaigns', detail: 'tick failed' })
    return NextResponse.json({ error: 'tick_failed' }, { status: 500 })
  }
}
