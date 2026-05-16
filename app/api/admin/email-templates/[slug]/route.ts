import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { TEMPLATE_CATALOG, type EmailTemplateSlug } from '@/lib/email-templates'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'api/admin/email-templates/slug' })

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ slug: string }>
}

function isKnownSlug(slug: string): slug is EmailTemplateSlug {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_CATALOG, slug)
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { slug } = await ctx.params
  if (!isKnownSlug(slug)) {
    return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
  }

  const def = TEMPLATE_CATALOG[slug]
  let override = null
  if (hasDatabase && prisma?.emailTemplate) {
    try {
      override = await prisma.emailTemplate.findUnique({ where: { slug } })
    } catch (error) {
      captureException(error, { context: 'api/admin/email-templates/slug', detail: 'GET override failed' })
      log.error({ err: error }, 'GET /api/admin/email-templates/[slug]: override failed')
    }
  }

  return NextResponse.json({
    slug: def.slug,
    label: def.label,
    description: def.description,
    variables: def.variables,
    defaults: {
      subject: def.defaultSubject,
      htmlBody: def.defaultHtml,
      textBody: def.defaultText ?? null,
    },
    override: override
      ? {
          subject: override.subject,
          htmlBody: override.htmlBody,
          textBody: override.textBody,
          isActive: override.isActive,
          updatedAt: override.updatedAt,
        }
      : null,
  })
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { slug } = await ctx.params
  if (!isKnownSlug(slug)) {
    return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
  }

  if (!hasDatabase || !prisma?.emailTemplate) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
  }

  let body: { subject?: string; htmlBody?: string; textBody?: string | null; isActive?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const subject = (body.subject || '').trim()
  const htmlBody = (body.htmlBody || '').trim()
  if (!subject) {
    return NextResponse.json({ error: 'Subject é obrigatório.' }, { status: 400 })
  }
  if (!htmlBody) {
    return NextResponse.json({ error: 'HTML é obrigatório.' }, { status: 400 })
  }

  const textBody = body.textBody && body.textBody.trim() ? body.textBody : null
  const isActive = body.isActive !== false

  try {
    const saved = await prisma.emailTemplate.upsert({
      where: { slug },
      update: { subject, htmlBody, textBody, isActive },
      create: { slug, subject, htmlBody, textBody, isActive },
    })

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'email_template.update',
      targetType: 'EmailTemplate',
      targetId: saved.id,
      summary: `Template ${slug} customizado`,
      metadata: { slug, isActive },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({
      slug: saved.slug,
      subject: saved.subject,
      htmlBody: saved.htmlBody,
      textBody: saved.textBody,
      isActive: saved.isActive,
      updatedAt: saved.updatedAt,
    })
  } catch (error) {
    captureException(error, { context: 'api/admin/email-templates/slug', detail: 'PUT failed' })
    log.error({ err: error }, 'PUT /api/admin/email-templates/[slug] failed')
    return NextResponse.json({ error: 'Erro ao salvar template.' }, { status: 500 })
  }
}

/**
 * Restaurar padrão = apagar o override. Após isso, sendTemplate volta a usar
 * o defaultHtml/defaultSubject hardcoded.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { slug } = await ctx.params
  if (!isKnownSlug(slug)) {
    return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
  }
  if (!hasDatabase || !prisma?.emailTemplate) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
  }

  try {
    await prisma.emailTemplate.deleteMany({ where: { slug } })
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'email_template.reset',
      targetType: 'EmailTemplate',
      targetId: slug,
      summary: `Template ${slug} restaurado para o padrão`,
      ip: getClientIp(request),
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    captureException(error, { context: 'api/admin/email-templates/slug', detail: 'DELETE failed' })
    log.error({ err: error }, 'DELETE /api/admin/email-templates/[slug] failed')
    return NextResponse.json({ error: 'Erro ao restaurar padrão.' }, { status: 500 })
  }
}
