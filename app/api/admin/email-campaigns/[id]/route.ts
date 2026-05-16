import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { parseSegment } from '@/lib/email-segments'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'api/admin/email-campaigns/id' })

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.emailCampaign) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
  }
  const { id } = await ctx.params
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.emailCampaign) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
  }
  const { id } = await ctx.params

  const existing = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
  if (existing.status === 'sending' || existing.status === 'sent') {
    return NextResponse.json({ error: 'Não é possível editar campanha em envio ou já enviada.' }, { status: 409 })
  }

  let body: {
    name?: string
    subject?: string
    htmlBody?: string
    textBody?: string | null
    segment?: unknown
    scheduledAt?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
  if (typeof body.subject === 'string' && body.subject.trim()) update.subject = body.subject.trim()
  if (typeof body.htmlBody === 'string' && body.htmlBody.trim()) update.htmlBody = body.htmlBody.trim()
  if (body.textBody !== undefined) {
    update.textBody = body.textBody && body.textBody.trim() ? body.textBody : null
  }
  if (body.segment !== undefined) {
    const segment = parseSegment(body.segment)
    if (!segment) return NextResponse.json({ error: 'Segmento inválido.' }, { status: 400 })
    update.segment = segment
  }
  if (body.scheduledAt !== undefined) {
    if (body.scheduledAt === null) {
      update.scheduledAt = null
      update.status = 'draft'
    } else {
      const parsed = new Date(body.scheduledAt)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'scheduledAt inválido.' }, { status: 400 })
      }
      update.scheduledAt = parsed
      update.status = 'scheduled'
    }
  }

  try {
    const saved = await prisma.emailCampaign.update({ where: { id }, data: update })
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'email_campaign.update',
      targetType: 'EmailCampaign',
      targetId: id,
      summary: `Campanha "${saved.name}" atualizada`,
      metadata: { changes: Object.keys(update) },
      ip: getClientIp(request),
    }).catch(() => {})
    return NextResponse.json(saved)
  } catch (error) {
    captureException(error, { context: 'api/admin/email-campaigns/id', detail: 'PUT failed' })
    log.error({ err: error }, 'PUT /api/admin/email-campaigns/[id] failed')
    return NextResponse.json({ error: 'Erro ao salvar campanha.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.emailCampaign) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
  }
  const { id } = await ctx.params

  const existing = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
  if (existing.status === 'sending' || existing.status === 'sent') {
    return NextResponse.json({ error: 'Não é possível excluir campanha em envio ou já enviada.' }, { status: 409 })
  }

  try {
    await prisma.emailCampaign.delete({ where: { id } })
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'email_campaign.delete',
      targetType: 'EmailCampaign',
      targetId: id,
      summary: `Campanha "${existing.name}" excluída`,
      ip: getClientIp(request),
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    captureException(error, { context: 'api/admin/email-campaigns/id', detail: 'DELETE failed' })
    log.error({ err: error }, 'DELETE /api/admin/email-campaigns/[id] failed')
    return NextResponse.json({ error: 'Erro ao excluir campanha.' }, { status: 500 })
  }
}
