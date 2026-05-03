import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { Prisma } from '@prisma/client'
import { captureException } from '@/lib/observability'

export interface BomEntry {
  id: string
  productId: string
  variantId: string | null
  variantName: string | null
  componentId: string
  componentName: string
  componentSku: string | null
  componentUnit: string
  componentStock: number
  componentLowThreshold: number | null
  quantityPerUnit: number
  notes: string | null
  /** Dá pra produzir N unidades só com o estoque atual deste componente. */
  coverageUnits: number
}

export interface BomCoverage {
  /** Quantas unidades do produto/variante dá pra produzir agora (gargalo do BOM). */
  maxProducible: number | null
  /** Componentes ordenados pelo gargalo (menor coverage primeiro). */
  entries: BomEntry[]
}

function toNum(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function toNumOrNull(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return typeof value === 'number' ? value : Number(value.toString())
}

/**
 * Lista BOM de um produto. Inclui linhas globais (variantId null) +
 * linhas específicas de cada variação. UI separa visualmente.
 */
export async function listProductBom(productId: string): Promise<BomEntry[]> {
  if (!hasDatabase || !prisma?.productComponent) return []
  try {
    const rows = await prisma.productComponent.findMany({
      where: { productId },
      include: {
        component: true,
        variant: { select: { id: true, name: true } },
      },
      orderBy: [{ variantId: 'asc' }, { component: { name: 'asc' } }],
    })

    return rows.map(row => {
      const stock = toNum(row.component.stock)
      const qpu = toNum(row.quantityPerUnit)
      const coverage = qpu > 0 ? Math.floor(stock / qpu) : 0
      return {
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        variantName: row.variant?.name ?? null,
        componentId: row.componentId,
        componentName: row.component.name,
        componentSku: row.component.sku,
        componentUnit: row.component.unit,
        componentStock: stock,
        componentLowThreshold: toNumOrNull(row.component.lowStockThreshold),
        quantityPerUnit: qpu,
        notes: row.notes,
        coverageUnits: coverage,
      }
    })
  } catch (error) {
    captureException(error, { context: 'product-bom', detail: 'listProductBom failed' })
    return []
  }
}

export interface UpsertBomInput {
  productId: string
  variantId?: string | null
  componentId: string
  quantityPerUnit: number
  notes?: string | null
}

function validateUpsert(input: UpsertBomInput): string | null {
  if (!input.productId) return 'productId obrigatório.'
  if (!input.componentId) return 'componentId obrigatório.'
  if (!Number.isFinite(input.quantityPerUnit) || input.quantityPerUnit <= 0) {
    return 'quantityPerUnit deve ser maior que zero.'
  }
  return null
}

export async function addBomEntry(
  input: UpsertBomInput,
): Promise<{ entry?: BomEntry; error?: string }> {
  if (!hasDatabase || !prisma?.productComponent) return { error: 'Banco indisponível.' }
  const error = validateUpsert(input)
  if (error) return { error }

  try {
    // Se já existe (productId, variantId, componentId), atualizamos —
    // vai virar PUT idempotente. Evita criar duplicata se admin clicar
    // duas vezes.
    const existing = await prisma.productComponent.findFirst({
      where: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        componentId: input.componentId,
      },
    })

    if (existing) {
      await prisma.productComponent.update({
        where: { id: existing.id },
        data: {
          quantityPerUnit: input.quantityPerUnit,
          notes: input.notes?.trim() || null,
        },
      })
    } else {
      await prisma.productComponent.create({
        data: {
          productId: input.productId,
          variantId: input.variantId ?? null,
          componentId: input.componentId,
          quantityPerUnit: input.quantityPerUnit,
          notes: input.notes?.trim() || null,
        },
      })
    }

    const list = await listProductBom(input.productId)
    const entry = list.find(
      e => e.componentId === input.componentId && (e.variantId ?? null) === (input.variantId ?? null),
    )
    return entry ? { entry } : { error: 'Erro ao recarregar BOM.' }
  } catch (err) {
    captureException(err, { context: 'product-bom', detail: 'addBomEntry failed' })
    return { error: 'Erro ao salvar BOM.' }
  }
}

export async function updateBomEntry(
  bomId: string,
  data: { quantityPerUnit?: number; notes?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productComponent) return { ok: false, error: 'Banco indisponível.' }
  if (data.quantityPerUnit !== undefined && (!Number.isFinite(data.quantityPerUnit) || data.quantityPerUnit <= 0)) {
    return { ok: false, error: 'Quantidade deve ser maior que zero.' }
  }
  try {
    const update: Prisma.ProductComponentUpdateInput = {}
    if (data.quantityPerUnit !== undefined) update.quantityPerUnit = data.quantityPerUnit
    if (data.notes !== undefined) update.notes = data.notes?.trim() || null
    await prisma.productComponent.update({ where: { id: bomId }, data: update })
    return { ok: true }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return { ok: false, error: 'Vínculo não encontrado.' }
    }
    captureException(err, { context: 'product-bom', detail: 'updateBomEntry failed' })
    return { ok: false, error: 'Erro ao atualizar.' }
  }
}

export async function removeBomEntry(bomId: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productComponent) return { ok: false, error: 'Banco indisponível.' }
  try {
    await prisma.productComponent.delete({ where: { id: bomId } })
    return { ok: true }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return { ok: false, error: 'Vínculo não encontrado.' }
    }
    captureException(err, { context: 'product-bom', detail: 'removeBomEntry failed' })
    return { ok: false, error: 'Erro ao remover.' }
  }
}

/**
 * Calcula a cobertura: quantas unidades do produto dá pra produzir HOJE
 * com o estoque atual.
 *
 * - Se variantId é fornecido: considera apenas os componentes globais
 *   (variantId NULL) + os específicos dessa variação.
 * - Sem variantId: considera só os globais.
 *
 * O gargalo é o menor `floor(stock / quantityPerUnit)` entre todos os
 * componentes envolvidos. Se algum componente tem `quantityPerUnit > 0`
 * e `stock = 0`, retorna 0.
 *
 * Se não há nenhum vínculo: retorna `null` (não dá pra calcular —
 * produto não tem BOM declarada).
 */
export async function getProductCoverage(
  productId: string,
  variantId?: string | null,
): Promise<BomCoverage> {
  const all = await listProductBom(productId)
  const relevant = all.filter(e => e.variantId === null || e.variantId === (variantId ?? null))
  if (relevant.length === 0) {
    return { maxProducible: null, entries: [] }
  }
  const sorted = [...relevant].sort((a, b) => a.coverageUnits - b.coverageUnits)
  const max = sorted[0].coverageUnits
  return { maxProducible: max, entries: sorted }
}
