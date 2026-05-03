import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { captureException } from '@/lib/observability'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { inferFilamentColor } from '@/lib/filament-color-inference'

export const dynamic = 'force-dynamic'

/**
 * Varre filamentos sem `colorHex` e tenta inferir a cor a partir do
 * nome. Retorna stats { total, updated, skipped, samples }.
 *
 * Por padrão, processa apenas filamentos com `colorHex IS NULL` pra
 * não sobrescrever cores que o admin já definiu manualmente.
 *
 * Aceita `?force=1` na query pra reprocessar todos (sobrescreve mesmo
 * com cor já definida) — não exposto na UI por padrão, só pra debug
 * via curl.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!hasDatabase || !prisma?.filament) {
    return NextResponse.json({ error: 'Banco indisponível.' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'

  try {
    const where = force ? {} : { colorHex: null }
    const candidates = await prisma.filament.findMany({
      where,
      select: { id: true, name: true, colorHex: true },
    })

    let updated = 0
    let skipped = 0
    const samples: Array<{ name: string; colorHex: string }> = []

    for (const filament of candidates) {
      const inferred = inferFilamentColor(filament.name)
      if (!inferred) {
        skipped += 1
        continue
      }
      // Se force, atualiza qualquer um. Senão, só os null.
      if (!force && filament.colorHex) {
        skipped += 1
        continue
      }
      try {
        await prisma.filament.update({
          where: { id: filament.id },
          data: { colorHex: inferred },
        })
        updated += 1
        if (samples.length < 10) samples.push({ name: filament.name, colorHex: inferred })
      } catch (error) {
        captureException(error, {
          context: 'filaments.auto-fill-colors',
          detail: 'update failed',
          filamentId: filament.id,
        })
        skipped += 1
      }
    }

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'filament.auto_fill_colors',
      targetType: 'Filament',
      targetId: null,
      summary: `Cores inferidas pelo nome: ${updated} atualizados, ${skipped} ignorados (${candidates.length} candidatos)`,
      metadata: { force, updated, skipped, total: candidates.length },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({
      total: candidates.length,
      updated,
      skipped,
      samples,
    })
  } catch (error) {
    captureException(error, { context: 'filaments.auto-fill-colors', detail: 'POST failed' })
    return NextResponse.json({ error: 'Erro ao inferir cores.' }, { status: 500 })
  }
}
