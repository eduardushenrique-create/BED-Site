import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { recordAuditEntry } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'
import { resolveAndCalculate, serializeEstimate, ValidationError } from '@/lib/orcamentos'

export const dynamic = 'force-dynamic'

const VALID_STATUS = new Set(['draft', 'sent', 'approved', 'rejected'])
// 'converted' nao eh setavel pelo PATCH — so via /converter-pedido

const RECALC_FIELDS = new Set([
  'filamentId',
  'filamentPricePerKgOverride',
  'filamentGrams',
  'printHours',
  'printerId',
  'components',
  'errorRateOverride',
  'marginPercentOverride',
])

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!hasDatabase || !(prisma as any)?.pricingEstimate) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  try {
    const row = await (prisma as any).pricingEstimate.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: 'Orcamento nao encontrado' }, { status: 404 })
    return NextResponse.json(serializeEstimate(row))
  } catch (error) {
    captureException(error, { context: 'api.orcamentos.[id].GET' })
    return NextResponse.json({ error: 'Erro ao buscar orcamento' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!hasDatabase || !(prisma as any)?.pricingEstimate) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  try {
    const current = await (prisma as any).pricingEstimate.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Orcamento nao encontrado' }, { status: 404 })
    if (current.status === 'converted') {
      return NextResponse.json(
        { error: 'Orcamento ja convertido em pedido — nao editavel' },
        { status: 409 },
      )
    }

    const decimal = (n: number) => new Prisma.Decimal(n)
    const data: Record<string, unknown> = {}

    // Campos simples (texto/numero) sem recalculo
    for (const key of ['name', 'customerName', 'customerPhone', 'customerEmail', 'notes'] as const) {
      if (body[key] !== undefined) data[key] = body[key]
    }
    if (body.status !== undefined) {
      if (!VALID_STATUS.has(body.status)) {
        return NextResponse.json({ error: `status invalido: ${body.status}` }, { status: 400 })
      }
      data.status = body.status
    }
    if (body.productId !== undefined) data.productId = body.productId
    if (body.quantity !== undefined) {
      const q = Number(body.quantity)
      if (!Number.isFinite(q) || q < 1) {
        return NextResponse.json({ error: 'quantity deve ser >= 1' }, { status: 400 })
      }
      data.quantity = q
    }
    if (body.finalPrice !== undefined) {
      if (body.finalPrice === null) {
        data.finalPrice = null
      } else {
        const fp = Number(body.finalPrice)
        if (!Number.isFinite(fp) || fp < 0) {
          return NextResponse.json({ error: 'finalPrice deve ser >= 0' }, { status: 400 })
        }
        data.finalPrice = decimal(fp)
      }
    }

    // Se algum input numerico mudou, recalcula
    const shouldRecalc = Array.from(RECALC_FIELDS).some(f => body[f] !== undefined)
    if (shouldRecalc) {
      const calc = await resolveAndCalculate({
        filamentId: body.filamentId !== undefined ? body.filamentId : current.filamentId,
        filamentPricePerKgOverride: body.filamentPricePerKgOverride ?? null,
        filamentGrams: Number(body.filamentGrams ?? current.filamentGrams),
        printHours: Number(body.printHours ?? current.printHours),
        printerId: body.printerId !== undefined ? body.printerId : current.printerId,
        components: Array.isArray(body.components)
          ? body.components
          : (current.componentsJson as any[]).map((c: any) => ({
              componentId: c.componentId,
              qty: c.qty,
              unitCostOverride: c.unitCostSnapshot,
              name: c.name,
              unit: c.unit,
            })),
        errorRateOverride:
          body.errorRateOverride !== undefined ? body.errorRateOverride : Number(current.errorRate),
        marginPercentOverride:
          body.marginPercentOverride !== undefined
            ? body.marginPercentOverride
            : Number(current.marginPercent),
      })
      Object.assign(data, {
        filamentId: body.filamentId !== undefined ? body.filamentId : current.filamentId,
        filamentGrams: decimal(Number(body.filamentGrams ?? current.filamentGrams)),
        printHours: decimal(Number(body.printHours ?? current.printHours)),
        printerId: body.printerId !== undefined ? body.printerId : current.printerId,
        componentsJson: calc.snapshots.componentsSnapshot,
        filamentPricePerKgSnapshot: decimal(calc.snapshots.filamentPricePerKgSnapshot),
        energyCostPerHourSnapshot: decimal(calc.snapshots.energyCostPerHourSnapshot),
        depreciationPerHourSnapshot: decimal(calc.snapshots.depreciationPerHourSnapshot),
        errorRate: decimal(calc.snapshots.errorRate),
        marginPercent: decimal(calc.snapshots.marginPercent),
        costFilament: decimal(calc.result.costFilament),
        costEnergy: decimal(calc.result.costEnergy),
        costDepreciation: decimal(calc.result.costDepreciation),
        costError: decimal(calc.result.costError),
        costComponents: decimal(calc.result.costComponents),
        costTotal: decimal(calc.result.costTotal),
        suggestedPrice: decimal(calc.result.suggestedPrice),
      })
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    data.updatedByEmail = auth.user?.email ?? null

    const updated = await (prisma as any).pricingEstimate.update({
      where: { id },
      data,
    })

    await recordAuditEntry({
      actorEmail: auth.user?.email ?? 'unknown',
      action: 'ESTIMATE_UPDATED',
      targetType: 'PricingEstimate',
      targetId: id,
      summary: `Orcamento "${updated.name}" atualizado${shouldRecalc ? ' (recalculado)' : ''}`,
      metadata: { fields: Object.keys(data).filter(k => k !== 'updatedByEmail') },
    })

    return NextResponse.json(serializeEstimate(updated))
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    captureException(error, { context: 'api.orcamentos.[id].PATCH' })
    return NextResponse.json({ error: 'Erro ao atualizar orcamento' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!hasDatabase || !(prisma as any)?.pricingEstimate) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  try {
    const row = await (prisma as any).pricingEstimate.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: 'Orcamento nao encontrado' }, { status: 404 })
    if (row.status === 'converted') {
      return NextResponse.json(
        { error: 'Orcamento ja convertido em pedido — nao pode ser excluido' },
        { status: 409 },
      )
    }

    // AuditLog ANTES do hard-delete (sem soft-delete pra orcamentos —
    // SPEC-007 §3.1.2: orcamento != pedido; sem implicacao financeira)
    await recordAuditEntry({
      actorEmail: auth.user?.email ?? 'unknown',
      action: 'ESTIMATE_DELETED',
      targetType: 'PricingEstimate',
      targetId: id,
      summary: `Orcamento "${row.name}" excluido`,
      metadata: { status: row.status, costTotal: row.costTotal?.toString() },
    })

    await (prisma as any).pricingEstimate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.orcamentos.[id].DELETE' })
    return NextResponse.json({ error: 'Erro ao excluir orcamento' }, { status: 500 })
  }
}
