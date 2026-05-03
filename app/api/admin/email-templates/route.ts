import { NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { getCatalog } from '@/lib/email-templates'

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
      console.error('[api/admin/email-templates] failed to load overrides:', error)
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
