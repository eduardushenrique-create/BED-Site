import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { parseSegment } from '@/lib/email-segments'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.emailCampaign) {
    return NextResponse.json({ campaigns: [] })
  }
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ campaigns })
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.emailCampaign) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
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

  const name = (body.name || '').trim()
  const subject = (body.subject || '').trim()
  const htmlBody = (body.htmlBody || '').trim()
  if (!name || !subject || !htmlBody) {
    return NextResponse.json({ error: 'name, subject e htmlBody são obrigatórios.' }, { status: 400 })
  }

  const segment = parseSegment(body.segment)
  if (!segment) {
    return NextResponse.json({ error: 'Segmento inválido.' }, { status: 400 })
  }

  let scheduledAt: Date | null = null
  if (body.scheduledAt) {
    const parsed = new Date(body.scheduledAt)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'scheduledAt inválido.' }, { status: 400 })
    }
    scheduledAt = parsed
  }

  try {
    const created = await prisma.emailCampaign.create({
      data: {
        name,
        subject,
        htmlBody,
        textBody: body.textBody && body.textBody.trim() ? body.textBody : null,
        segment,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt,
        createdByEmail: auth.user!.email,
      },
    })
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'email_campaign.create',
      targetType: 'EmailCampaign',
      targetId: created.id,
      summary: `Campanha "${created.name}" criada`,
      metadata: { segment, status: created.status },
      ip: getClientIp(request),
    }).catch(() => {})
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[api/admin/email-campaigns] POST failed:', error)
    return NextResponse.json({ error: 'Erro ao criar campanha.' }, { status: 500 })
  }
}
