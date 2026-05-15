import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { recordAuditEntry } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'
import type { PricingTier } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const SINGLETON_ID = 'singleton'

function toNumber(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0
  if (typeof d === 'number') return d
  return Number(d.toString())
}

function serialize(row: any) {
  return {
    id: row.id,
    defaultEnergyCostPerHour: toNumber(row.defaultEnergyCostPerHour),
    defaultDepreciationPerHour: toNumber(row.defaultDepreciationPerHour),
    defaultErrorRate: toNumber(row.defaultErrorRate),
    energyTariffPerKwh: toNumber(row.energyTariffPerKwh),
    marginTiers: row.marginTiersJson as PricingTier[],
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    updatedByEmail: row.updatedByEmail ?? null,
  }
}

function validateMarginTiers(value: unknown): { ok: true; tiers: PricingTier[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: 'marginTiers deve ser array' }
  if (value.length === 0) return { ok: false, error: 'marginTiers nao pode ser vazio' }
  let hasOpenEnd = false
  for (const [i, t] of value.entries()) {
    if (typeof t !== 'object' || t === null) {
      return { ok: false, error: `marginTiers[${i}] deve ser objeto` }
    }
    const tier = t as Record<string, unknown>
    if (tier.maxCost !== null && (typeof tier.maxCost !== 'number' || tier.maxCost <= 0)) {
      return { ok: false, error: `marginTiers[${i}].maxCost deve ser number > 0 ou null` }
    }
    if (typeof tier.marginPercent !== 'number' || tier.marginPercent < 0 || tier.marginPercent > 10) {
      return { ok: false, error: `marginTiers[${i}].marginPercent deve estar entre 0 e 10 (ex.: 0.6 = 60%)` }
    }
    if (tier.maxCost === null) hasOpenEnd = true
  }
  if (!hasOpenEnd) {
    return { ok: false, error: 'marginTiers precisa ter ao menos 1 faixa com maxCost=null (faixa final aberta)' }
  }
  return { ok: true, tiers: value as PricingTier[] }
}

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!hasDatabase || !(prisma as any)?.pricingSettings) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  try {
    const row = await (prisma as any).pricingSettings.findUnique({
      where: { id: SINGLETON_ID },
    })
    if (!row) {
      return NextResponse.json(
        { error: 'PricingSettings nao inicializado. Migration nao rodou?' },
        { status: 503 },
      )
    }
    return NextResponse.json(serialize(row))
  } catch (error) {
    captureException(error, { context: 'api.admin.pricing-settings.GET' })
    return NextResponse.json({ error: 'Erro ao ler configuracoes' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!hasDatabase || !(prisma as any)?.pricingSettings) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  // Decimal positivos
  for (const key of [
    'defaultEnergyCostPerHour',
    'defaultDepreciationPerHour',
    'defaultErrorRate',
    'energyTariffPerKwh',
  ] as const) {
    if (body[key] !== undefined) {
      const v = Number(body[key])
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `${key} deve ser numero >= 0` }, { status: 400 })
      }
      if (key === 'defaultErrorRate' && v > 1) {
        return NextResponse.json(
          { error: 'defaultErrorRate deve ser fracao (0..1). Ex.: 0.30 = 30%' },
          { status: 400 },
        )
      }
      data[key] = new Prisma.Decimal(v)
    }
  }

  // marginTiers
  if (body.marginTiers !== undefined) {
    const r = validateMarginTiers(body.marginTiers)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    data.marginTiersJson = r.tiers
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  data.updatedByEmail = auth.user?.email ?? null

  try {
    const updated = await (prisma as any).pricingSettings.update({
      where: { id: SINGLETON_ID },
      data,
    })

    await recordAuditEntry({
      actorEmail: auth.user?.email ?? 'unknown',
      action: 'PRICING_SETTINGS_UPDATED',
      targetType: 'PricingSettings',
      targetId: SINGLETON_ID,
      summary: `Atualizado: ${Object.keys(data).filter(k => k !== 'updatedByEmail').join(', ')}`,
      metadata: Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'updatedByEmail')),
    })

    return NextResponse.json(serialize(updated))
  } catch (error) {
    captureException(error, { context: 'api.admin.pricing-settings.PATCH' })
    return NextResponse.json({ error: 'Erro ao salvar configuracoes' }, { status: 500 })
  }
}
