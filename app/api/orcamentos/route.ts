import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { recordAuditEntry } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'
import { resolveAndCalculate, serializeEstimate, ValidationError } from '@/lib/orcamentos'

export const dynamic = 'force-dynamic'

/**
 * SPEC-007 §3.1.2 — listagem e criacao de orcamentos.
 *
 * GET  /api/orcamentos    — lista paginada com filtros
 * POST /api/orcamentos    — cria orcamento (calcula no servidor + persiste snapshots)
 */

const VALID_STATUS = new Set(['draft', 'sent', 'approved', 'rejected', 'converted'])

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!hasDatabase || !(prisma as any)?.pricingEstimate) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))
  const status = searchParams.get('status') || undefined
  const productId = searchParams.get('productId') || undefined
  const search = searchParams.get('search')?.trim() || undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined

  const where: any = {}
  if (status) {
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: `status invalido: ${status}` }, { status: 400 })
    }
    where.status = status
  }
  if (productId) where.productId = productId
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to)
  }

  try {
    const [items, total] = await Promise.all([
      (prisma as any).pricingEstimate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      (prisma as any).pricingEstimate.count({ where }),
    ])
    return NextResponse.json({
      items: items.map(serializeEstimate),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    captureException(error, { context: 'api.orcamentos.GET' })
    return NextResponse.json({ error: 'Erro ao listar orcamentos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!hasDatabase || !(prisma as any)?.pricingEstimate) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  // Validacoes basicas do payload
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name eh obrigatorio' }, { status: 400 })
  }
  const quantity = Number(body.quantity ?? 1)
  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: 'quantity deve ser >= 1' }, { status: 400 })
  }
  const finalPriceInput = body.finalPrice
  if (finalPriceInput !== undefined && finalPriceInput !== null) {
    const fp = Number(finalPriceInput)
    if (!Number.isFinite(fp) || fp < 0) {
      return NextResponse.json({ error: 'finalPrice deve ser numero >= 0' }, { status: 400 })
    }
  }

  try {
    // Calcula no servidor (nunca confia no client)
    const calc = await resolveAndCalculate({
      filamentId: body.filamentId ?? null,
      filamentPricePerKgOverride: body.filamentPricePerKgOverride ?? null,
      filamentGrams: Number(body.filamentGrams),
      printHours: Number(body.printHours),
      printerId: body.printerId ?? null,
      components: Array.isArray(body.components) ? body.components : [],
      errorRateOverride: body.errorRateOverride ?? null,
      marginPercentOverride: body.marginPercentOverride ?? null,
    })

    const decimal = (n: number) => new Prisma.Decimal(n)

    const created = await (prisma as any).pricingEstimate.create({
      data: {
        name: body.name,
        status: 'draft',
        productId: body.productId ?? null,
        customerName: body.customerName ?? null,
        customerPhone: body.customerPhone ?? null,
        customerEmail: body.customerEmail ?? null,
        notes: body.notes ?? null,
        quantity,
        filamentId: body.filamentId ?? null,
        filamentGrams: decimal(Number(body.filamentGrams)),
        printHours: decimal(Number(body.printHours)),
        printerId: body.printerId ?? null,
        componentsJson: calc.snapshots.componentsSnapshot as any,
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
        finalPrice: finalPriceInput != null ? decimal(Number(finalPriceInput)) : null,
        createdByEmail: auth.user?.email ?? null,
      },
    })

    await recordAuditEntry({
      actorEmail: auth.user?.email ?? 'unknown',
      action: 'ESTIMATE_CREATED',
      targetType: 'PricingEstimate',
      targetId: created.id,
      summary: `Orcamento "${created.name}" criado (R$ ${calc.result.suggestedPrice.toFixed(2)} sugerido)`,
      metadata: { costTotal: calc.result.costTotal, marginPercent: calc.snapshots.marginPercent },
    })

    return NextResponse.json(serializeEstimate(created), { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    captureException(error, { context: 'api.orcamentos.POST' })
    return NextResponse.json({ error: 'Erro ao criar orcamento' }, { status: 500 })
  }
}
