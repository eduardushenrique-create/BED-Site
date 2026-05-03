import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { dispatchCampaignInBackground } from '@/lib/email-dispatcher'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Dispara uma campanha imediatamente. Retorna 202 e processa em background.
 * Cliente acompanha pelo polling em GET /api/admin/email-campaigns/[id].
 *
 * Aceita campanhas em status `draft` ou `scheduled`. Recusa `sending|sent|
 * failed|cancelled` com 409 — pra evitar disparo duplo.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.emailCampaign) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
  }

  const { id } = await ctx.params
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
  }

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return NextResponse.json(
      { error: `Campanha em status "${campaign.status}" não pode ser disparada.` },
      { status: 409 },
    )
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Resend não configurado — defina RESEND_API_KEY antes de disparar.' },
      { status: 503 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  if (!appUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL não configurada — link de descadastro precisa de host.' },
      { status: 503 },
    )
  }

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'email_campaign.dispatch',
    targetType: 'EmailCampaign',
    targetId: id,
    summary: `Campanha "${campaign.name}" disparada manualmente`,
    ip: getClientIp(request),
  }).catch(() => {})

  dispatchCampaignInBackground(id, appUrl)

  return NextResponse.json({ accepted: true, campaignId: id }, { status: 202 })
}
