import { NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { getCatalog } from '@/lib/email-templates'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'api/admin/email-templates' })

export const dynamic = 'force-dynamic'

/**
 * Lista todos os templates do catálogo, casados com seus overrides salvos
 * no banco. UI usa isso pra mostrar status (padrão / customizado / desativado).
 */
export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const catalog = getCatalog()

  let overrides: Record<string, { id: string; updatedAt: Date; isActive: boolean }> = {}
  if (hasDatabase && prisma?.emailTemplate) {
    try {
      const rows = await prisma.emailTemplate.findMany({
        select: { id: true, slug: true, updatedAt: true, isActive: true },
      })
      overrides = Object.fromEntries(rows.map(row => [row.slug, row]))
    } catch (error) {
      captureException(error, { context: 'api/admin/email-templates', detail: 'failed to load overrides' })
      log.error({ err: error }, 'GET /api/admin/email-templates: failed to load overrides')
    }
  }

  const templates = catalog.map(def => {
    const override = overrides[def.slug]
    return {
      slug: def.slug,
      label: def.label,
      description: def.description,
      hasOverride: Boolean(override),
      isActive: override ? override.isActive : true,
      updatedAt: override?.updatedAt ?? null,
    }
  })

  return NextResponse.json({ templates })
}
