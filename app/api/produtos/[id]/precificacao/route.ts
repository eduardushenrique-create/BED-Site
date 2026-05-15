import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { recordAuditEntry } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'
import { resolveAndCalculate, ValidationError } from '@/lib/orcamentos'

export const dynamic = 'force-dynamic'

/**
 * SPEC-007 §3.2.2 — persiste parametros de precificacao do produto + opcional
 * aplicar preco sugerido.
 *
 * PATCH body:
 *   {
 *     printingMinutes?: number,
 *     errorRatePercent?: number,    // 0..100 (UI envia em %)
 *     markupPercent?: number,        // 0..N (UI envia em %)
 *     printerForCostId?: string|null,
 *     applyPriceUpdate?: boolean,    // se true, escreve em Product.price
 *   }
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { id } = await ctx.params
  if (!hasDatabase || !(prisma as any)?.product) {
    return NextResponse.json({ error: 'Banco de dados indisponivel' }, { status: 503 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.printingMinutes !== undefined) {
    const v = Number(body.printingMinutes)
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: 'printingMinutes invalido' }, { status: 400 })
    }
    data.printingMinutes = v
  }
  if (body.errorRatePercent !== undefined) {
    const v = Number(body.errorRatePercent)
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return NextResponse.json({ error: 'errorRatePercent deve ser 0..100' }, { status: 400 })
    }
    data.errorRatePercent = new Prisma.Decimal(v)
  }
  if (body.markupPercent !== undefined) {
    const v = Number(body.markupPercent)
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: 'markupPercent invalido' }, { status: 400 })
    }
    data.markupPercent = new Prisma.Decimal(v)
  }
  if (body.printerForCostId !== undefined) {
    data.printerForCostId = body.printerForCostId
  }

  try {
    const current = await (prisma as any).product.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: 'Produto nao encontrado' }, { status: 404 })
    }

    // Se applyPriceUpdate, recalcula no servidor (NUNCA confia em preco vindo do client)
    // e atualiza Product.price junto com os outros campos.
    if (body.applyPriceUpdate === true) {
      // Buscar BOM atualizado
      const productWithBom = await (prisma as any).product.findUnique({
        where: { id },
        include: {
          filaments: { include: { filament: true } },
          components: { include: { component: true } },
        },
      })
      if (!productWithBom || productWithBom.filaments.length === 0) {
        return NextResponse.json(
          { error: 'Produto sem filamento no BOM — nao da pra calcular preco' },
          { status: 400 },
        )
      }
      const filamentGrams = productWithBom.filaments.reduce(
        (sum: number, pf: any) => sum + Number(pf.grams ?? 0),
        0,
      )
      const printingMinutes =
        (data.printingMinutes as number | undefined) ?? productWithBom.printingMinutes ?? 0
      if (printingMinutes <= 0) {
        return NextResponse.json(
          { error: 'Produto sem printingMinutes — nao da pra calcular preco' },
          { status: 400 },
        )
      }
      const errorRatePercent =
        data.errorRatePercent != null
          ? Number(data.errorRatePercent)
          : Number(productWithBom.errorRatePercent ?? 30)
      const markupPercent =
        data.markupPercent != null
          ? Number(data.markupPercent)
          : productWithBom.markupPercent != null
            ? Number(productWithBom.markupPercent)
            : null
      if (markupPercent == null) {
        return NextResponse.json(
          { error: 'Produto sem markupPercent — defina margem antes de aplicar preco' },
          { status: 400 },
        )
      }

      const calc = await resolveAndCalculate({
        filamentId: productWithBom.filaments[0].filamentId,
        filamentGrams,
        printHours: printingMinutes / 60,
        printerId:
          (data.printerForCostId as string | null | undefined) ?? productWithBom.printerForCostId,
        components: productWithBom.components.map((pc: any) => ({
          componentId: pc.componentId,
          qty: Number(pc.quantityPerUnit ?? 1),
        })),
        errorRateOverride: errorRatePercent / 100,
        marginPercentOverride: markupPercent / 100,
      })

      data.price = new Prisma.Decimal(calc.result.suggestedPrice)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    const updated = await (prisma as any).product.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        price: true,
        printingMinutes: true,
        errorRatePercent: true,
        markupPercent: true,
        printerForCostId: true,
      },
    })

    await recordAuditEntry({
      actorEmail: auth.user?.email ?? 'unknown',
      action: body.applyPriceUpdate ? 'PRODUCT_PRICE_RECALCULATED' : 'PRODUCT_PRICING_UPDATED',
      targetType: 'Product',
      targetId: id,
      summary: body.applyPriceUpdate
        ? `Produto "${updated.name}": preco aplicado a partir do calculo (R$ ${Number(updated.price).toFixed(2)})`
        : `Produto "${updated.name}": parametros de precificacao atualizados`,
      metadata: { fields: Object.keys(data), newPrice: body.applyPriceUpdate ? Number(updated.price) : undefined },
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      price: Number(updated.price),
      printingMinutes: updated.printingMinutes,
      errorRatePercent: updated.errorRatePercent != null ? Number(updated.errorRatePercent) : null,
      markupPercent: updated.markupPercent != null ? Number(updated.markupPercent) : null,
      printerForCostId: updated.printerForCostId,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    captureException(error, { context: 'api.produtos.precificacao.PATCH' })
    return NextResponse.json({ error: 'Erro ao atualizar precificacao' }, { status: 500 })
  }
}
