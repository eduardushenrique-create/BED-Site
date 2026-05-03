import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { TEMPLATE_CATALOG, renderTemplate, type EmailTemplateSlug } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ slug: string }>
}

function isKnownSlug(slug: string): slug is EmailTemplateSlug {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_CATALOG, slug)
}

/**
 * Renderiza o template (subject + html) usando os exemplos de cada variável
 * declarados no catálogo. Aceita o body cru do editor pra preview ao vivo.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { slug } = await ctx.params
  if (!isKnownSlug(slug)) {
    return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
  }

  const def = TEMPLATE_CATALOG[slug]
  let body: { subject?: string; htmlBody?: string; textBody?: string | null }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const variables: Record<string, string | number> = {}
  const rawVariables: Record<string, string> = {}
  for (const v of def.variables) {
    if (v.name === 'itemsHtml') {
      // raw vars não passam pela escapagem — mantemos exemplo cru
      rawVariables[v.name] = v.example
    } else {
      variables[v.name] = v.example
    }
  }

  const rendered = renderTemplate(
    {
      subject: body.subject || def.defaultSubject,
      htmlBody: body.htmlBody || def.defaultHtml,
      textBody: body.textBody ?? def.defaultText ?? null,
    },
    variables,
    rawVariables,
  )

  return NextResponse.json(rendered)
}
