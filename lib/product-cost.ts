import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { Prisma } from '@prisma/client'
import { captureException } from '@/lib/observability'

/**
 * Tarifa de energia em R$/kWh. Stakeholder pediu hardcoded no
 * cálculo (Q3 da spec). Pra mudar, alterar este const.
 */
export const ENERGY_RATE_BRL_PER_KWH = 1.0

/**
 * Taxa de erro padrão sobre o custo de filamento (Q6).
 * Aplicada como custoFilamento × (errorRatePercent / 100).
 */
export const DEFAULT_ERROR_RATE_PERCENT = 30.0

function toNum(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function toNumOrNull(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return typeof value === 'number' ? value : Number(value.toString())
}

export interface ProductFilamentEntry {
  id: string
  productId: string
  variantId: string | null
  variantName: string | null
  filamentId: string
  filamentName: string
  filamentBrand: string | null
  filamentType: string
  pricePerKg: number
  pricePerGram: number
  grams: number
  notes: string | null
  /** custo desta linha = grams × pricePerGram */
  cost: number
}

export interface CostBreakdown {
  filamentCost: number
  energyCost: number
  depreciationCost: number
  errorCost: number
  totalCost: number
  /** Preço sugerido = totalCost × (1 + markupPercent/100). Se markup é null, retorna totalCost. */
  suggestedPrice: number
  /** Markup% efetivo entre o preço atual do produto e o totalCost. Útil pra calculadora bidirecional. */
  effectiveMarkupPercent: number | null
}

export interface CostInputs {
  filamentEntries: ProductFilamentEntry[]
  printingMinutes: number
  /** Watts da impressora selecionada (ou null se não setado). */
  powerConsumptionWatts: number | null
  /** R$ de aquisição da impressora. */
  acquisitionCostBRL: number | null
  /** Vida útil em horas. */
  lifetimeHours: number | null
  /** Taxa de erro %. Default 30. */
  errorRatePercent: number
  /** Markup % aplicado sobre o totalCost pra obter o sugerido. Null = sem sugestão. */
  markupPercent: number | null
  /** Preço atual do produto (pra calcular `effectiveMarkupPercent`). */
  currentProductPrice: number | null
}

export function computeCostBreakdown(input: CostInputs): CostBreakdown {
  const filamentCost = input.filamentEntries.reduce((sum, e) => sum + e.cost, 0)

  const hours = input.printingMinutes > 0 ? input.printingMinutes / 60 : 0

  const energyCost =
    input.powerConsumptionWatts && input.powerConsumptionWatts > 0
      ? hours * (input.powerConsumptionWatts / 1000) * ENERGY_RATE_BRL_PER_KWH
      : 0

  const depreciationCost =
    input.acquisitionCostBRL &&
    input.lifetimeHours &&
    input.acquisitionCostBRL > 0 &&
    input.lifetimeHours > 0
      ? hours * (input.acquisitionCostBRL / input.lifetimeHours)
      : 0

  const errorCost = filamentCost * (input.errorRatePercent / 100)
  const totalCost = filamentCost + energyCost + depreciationCost + errorCost

  const suggestedPrice =
    input.markupPercent !== null && input.markupPercent !== undefined
      ? totalCost * (1 + input.markupPercent / 100)
      : totalCost

  const effectiveMarkupPercent =
    input.currentProductPrice !== null && totalCost > 0
      ? ((input.currentProductPrice - totalCost) / totalCost) * 100
      : null

  return {
    filamentCost: round2(filamentCost),
    energyCost: round2(energyCost),
    depreciationCost: round2(depreciationCost),
    errorCost: round2(errorCost),
    totalCost: round2(totalCost),
    suggestedPrice: round2(suggestedPrice),
    effectiveMarkupPercent: effectiveMarkupPercent !== null ? round2(effectiveMarkupPercent) : null,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function listProductFilaments(productId: string): Promise<ProductFilamentEntry[]> {
  if (!hasDatabase || !prisma?.productFilament) return []
  try {
    const rows = await prisma.productFilament.findMany({
      where: { productId },
      include: {
        filament: true,
        variant: { select: { id: true, name: true } },
      },
      orderBy: [{ variantId: 'asc' }, { filament: { name: 'asc' } }],
    })

    return rows.map(row => {
      const pricePerKg = toNum(row.filament.pricePerKg)
      const pricePerGram = pricePerKg / 1000
      const grams = toNum(row.grams)
      return {
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        variantName: row.variant?.name ?? null,
        filamentId: row.filamentId,
        filamentName: row.filament.name,
        filamentBrand: row.filament.brand,
        filamentType: row.filament.type,
        pricePerKg,
        pricePerGram: round2(pricePerGram * 10) / 10, // 4 casas via *10/10
        grams,
        notes: row.notes,
        cost: round2(grams * pricePerGram),
      }
    })
  } catch (error) {
    captureException(error, { context: 'product-cost', detail: 'listProductFilaments failed' })
    return []
  }
}

export interface UpsertProductFilamentInput {
  productId: string
  variantId?: string | null
  filamentId: string
  grams: number
  notes?: string | null
}

function validateUpsert(input: UpsertProductFilamentInput): string | null {
  if (!input.productId) return 'productId obrigatório.'
  if (!input.filamentId) return 'filamentId obrigatório.'
  if (!Number.isFinite(input.grams) || input.grams <= 0) {
    return 'Quantidade em gramas deve ser maior que zero.'
  }
  return null
}

export async function addProductFilament(
  input: UpsertProductFilamentInput,
): Promise<{ entry?: ProductFilamentEntry; error?: string }> {
  if (!hasDatabase || !prisma?.productFilament) return { error: 'Banco indisponível.' }
  const error = validateUpsert(input)
  if (error) return { error }
  try {
    // Idempotente — atualiza se já existe (productId, variantId, filamentId).
    const existing = await prisma.productFilament.findFirst({
      where: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        filamentId: input.filamentId,
      },
    })

    if (existing) {
      await prisma.productFilament.update({
        where: { id: existing.id },
        data: { grams: input.grams, notes: input.notes?.trim() || null },
      })
    } else {
      await prisma.productFilament.create({
        data: {
          productId: input.productId,
          variantId: input.variantId ?? null,
          filamentId: input.filamentId,
          grams: input.grams,
          notes: input.notes?.trim() || null,
        },
      })
    }

    const list = await listProductFilaments(input.productId)
    const entry = list.find(
      e =>
        e.filamentId === input.filamentId &&
        (e.variantId ?? null) === (input.variantId ?? null),
    )
    return entry ? { entry } : { error: 'Erro ao recarregar filamentos.' }
  } catch (err) {
    captureException(err, { context: 'product-cost', detail: 'addProductFilament failed' })
    return { error: 'Erro ao salvar filamento do produto.' }
  }
}

export async function updateProductFilament(
  id: string,
  data: { grams?: number; notes?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productFilament) return { ok: false, error: 'Banco indisponível.' }
  if (data.grams !== undefined && (!Number.isFinite(data.grams) || data.grams <= 0)) {
    return { ok: false, error: 'Quantidade em gramas deve ser maior que zero.' }
  }
  try {
    const update: Prisma.ProductFilamentUpdateInput = {}
    if (data.grams !== undefined) update.grams = data.grams
    if (data.notes !== undefined) update.notes = data.notes?.trim() || null
    await prisma.productFilament.update({ where: { id }, data: update })
    return { ok: true }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { ok: false, error: 'Linha não encontrada.' }
    captureException(err, { context: 'product-cost', detail: 'updateProductFilament failed' })
    return { ok: false, error: 'Erro ao atualizar.' }
  }
}

export async function removeProductFilament(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productFilament) return { ok: false, error: 'Banco indisponível.' }
  try {
    await prisma.productFilament.delete({ where: { id } })
    return { ok: true }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return { ok: false, error: 'Linha não encontrada.' }
    captureException(err, { context: 'product-cost', detail: 'removeProductFilament failed' })
    return { ok: false, error: 'Erro ao remover.' }
  }
}

// ---------------------------------------------------------------------------
// Cost settings do produto (printer + minutes + markup + errorRate)
// ---------------------------------------------------------------------------

export interface ProductCostSettings {
  printerForCostId: string | null
  printingMinutes: number | null
  markupPercent: number | null
  errorRatePercent: number
  printerInfo: {
    id: string
    name: string
    powerConsumptionWatts: number | null
    acquisitionCostBRL: number | null
    lifetimeHours: number | null
  } | null
}

export async function getProductCostSettings(productId: string): Promise<ProductCostSettings | null> {
  if (!hasDatabase || !prisma?.product) return null
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        printerForCostId: true,
        printingMinutes: true,
        markupPercent: true,
        errorRatePercent: true,
        printerForCost: {
          select: {
            id: true,
            name: true,
            powerConsumptionWatts: true,
            acquisitionCostBRL: true,
            lifetimeHours: true,
          },
        },
      },
    })
    if (!product) return null

    const errorRate =
      product.errorRatePercent !== null
        ? toNum(product.errorRatePercent)
        : DEFAULT_ERROR_RATE_PERCENT

    return {
      printerForCostId: product.printerForCostId,
      printingMinutes: product.printingMinutes,
      markupPercent: toNumOrNull(product.markupPercent),
      errorRatePercent: errorRate,
      printerInfo: product.printerForCost
        ? {
            id: product.printerForCost.id,
            name: product.printerForCost.name,
            powerConsumptionWatts: product.printerForCost.powerConsumptionWatts,
            acquisitionCostBRL: toNumOrNull(product.printerForCost.acquisitionCostBRL),
            lifetimeHours: product.printerForCost.lifetimeHours,
          }
        : null,
    }
  } catch (error) {
    captureException(error, { context: 'product-cost', detail: 'getProductCostSettings failed' })
    return null
  }
}

export interface UpdateProductCostSettingsInput {
  printerForCostId?: string | null
  printingMinutes?: number | null
  markupPercent?: number | null
  errorRatePercent?: number | null
}

export async function updateProductCostSettings(
  productId: string,
  input: UpdateProductCostSettingsInput,
): Promise<{ ok: boolean; settings?: ProductCostSettings; error?: string }> {
  if (!hasDatabase || !prisma?.product) return { ok: false, error: 'Banco indisponível.' }
  try {
    const data: Prisma.ProductUpdateInput = {}
    if (input.printerForCostId !== undefined) {
      if (input.printerForCostId === null || input.printerForCostId === '') {
        data.printerForCost = { disconnect: true }
      } else {
        data.printerForCost = { connect: { id: input.printerForCostId } }
      }
    }
    if (input.printingMinutes !== undefined) {
      data.printingMinutes =
        input.printingMinutes === null
          ? null
          : Math.max(0, Math.floor(Number(input.printingMinutes) || 0))
    }
    if (input.markupPercent !== undefined) {
      data.markupPercent = input.markupPercent === null ? null : Math.max(0, Number(input.markupPercent))
    }
    if (input.errorRatePercent !== undefined) {
      data.errorRatePercent =
        input.errorRatePercent === null ? null : Math.max(0, Number(input.errorRatePercent))
    }

    await prisma.product.update({ where: { id: productId }, data })
    const settings = await getProductCostSettings(productId)
    return { ok: true, settings: settings || undefined }
  } catch (error) {
    captureException(error, { context: 'product-cost', detail: 'updateProductCostSettings failed' })
    return { ok: false, error: 'Erro ao salvar configuração de custo.' }
  }
}
