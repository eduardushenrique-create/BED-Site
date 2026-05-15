import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { resolveAndCalculate, ValidationError } from '@/lib/orcamentos'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * SPEC-007 §3.2.2 — calculadora de PRODUTO (Modo 1). Dry-run.
 *
 * Le ProductFilament, ProductComponent e parametros do Product (printingMinutes,
 * errorRatePercent, markupPercent, printerForCostId). Aplica overrides opcionais
 * para "what-if" e devolve breakdown SEM persistir.
 *
 * NAO cria PricingEstimate. Modo 1 vive 100% dentro do catalogo.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!hasDatabase || !(prisma as any)?.product) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  let body: any = {}
  try {
    const text = await request.text()
    body = text ? JSON.parse(text) : {}
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  try {
    const product = await (prisma as any).product.findUnique({
      where: { id },
      include: {
        filaments: { include: { filament: true } },
        components: { include: { component: true } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produto nao encontrado' }, { status: 404 })
    }

    // Resolve filamento principal (primeiro do BOM, ou override). Para o MVP
    // tratamos o primeiro filamento do BOM como o principal — produtos com
    // multiplos filamentos podem ajustar manualmente via override.
    let filamentId: string | null = body.filamentIdOverride ?? null
    let filamentGrams = 0
    if (!filamentId && product.filaments.length > 0) {
      filamentId = product.filaments[0].filamentId
      filamentGrams = product.filaments.reduce(
        (sum: number, pf: any) => sum + Number(pf.grams ?? 0),
        0,
      )
    } else if (body.filamentGramsOverride != null) {
      filamentGrams = Number(body.filamentGramsOverride)
    }
    if (!filamentId) {
      return NextResponse.json(
        {
          error:
            'Produto sem filamento no BOM. Cadastre em /admin/produtos/[id] ou passe filamentIdOverride.',
        },
        { status: 400 },
      )
    }
    if (filamentGrams <= 0 && body.filamentGramsOverride == null) {
      return NextResponse.json(
        { error: 'BOM de filamento sem gramas. Cadastre em /admin/produtos/[id].' },
        { status: 400 },
      )
    }

    // printHours = printingMinutes / 60 (ou override)
    const printingMinutes =
      body.printingMinutesOverride != null
        ? Number(body.printingMinutesOverride)
        : product.printingMinutes ?? 0
    if (printingMinutes <= 0) {
      return NextResponse.json(
        {
          error:
            'Produto sem tempo de impressao cadastrado. Defina Product.printingMinutes ou passe printingMinutesOverride.',
        },
        { status: 400 },
      )
    }
    const printHours = printingMinutes / 60

    // Components do BOM
    const components = Array.isArray(body.componentsOverride)
      ? body.componentsOverride
      : product.components.map((pc: any) => ({
          componentId: pc.componentId,
          qty: Number(pc.quantityPerUnit ?? 1),
        }))

    // errorRate / margin — convertendo de "%" pra fracao se vier do produto
    const errorRateRaw =
      body.errorRatePercentOverride != null
        ? Number(body.errorRatePercentOverride)
        : Number(product.errorRatePercent ?? 30)
    const errorRate = errorRateRaw / 100

    const markupRaw =
      body.markupPercentOverride != null
        ? Number(body.markupPercentOverride)
        : product.markupPercent != null
          ? Number(product.markupPercent)
          : null
    const marginPercentOverride = markupRaw != null ? markupRaw / 100 : null

    const out = await resolveAndCalculate({
      filamentId,
      filamentGrams,
      printHours,
      printerId: body.printerIdOverride ?? product.printerForCostId ?? null,
      components,
      errorRateOverride: errorRate,
      marginPercentOverride,
    })

    return NextResponse.json({
      ...out.result,
      marginPercentApplied: out.snapshots.marginPercent,
      // Devolve valores em % tambem pra UI exibir
      errorRatePercentApplied: out.snapshots.errorRate * 100,
      markupPercentApplied: out.snapshots.marginPercent * 100,
      currentPrice: Number(product.price),
      warnings: out.warnings,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    captureException(error, { context: 'api.produtos.precificacao.calcular' })
    return NextResponse.json({ error: 'Erro ao calcular' }, { status: 500 })
  }
}
