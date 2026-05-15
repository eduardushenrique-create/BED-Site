import 'server-only'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import {
  calculate,
  findSuggestedMargin,
  type PricingCalculationResult,
  type PricingComponentInput,
  type PricingTier,
} from '@/lib/pricing'

/**
 * SPEC-007 §3.1 — orchestracao do calculo de orcamento.
 *
 * Resolve inputs (FK lookups), aplica a calculadora pura (lib/pricing.ts) e
 * retorna o resultado + os snapshots que precisariam ser persistidos.
 *
 * Usado por:
 *   POST /api/orcamentos/calcular        (dry-run, so retorna result)
 *   POST /api/orcamentos                 (cria PricingEstimate)
 *   POST /api/orcamentos/[id]/converter-pedido (le snapshots existentes)
 */

export type ResolveAndCalculateInput = {
  filamentId?: string | null
  filamentPricePerKgOverride?: number | null
  filamentGrams: number
  printHours: number
  printerId?: string | null
  components: Array<{ componentId?: string | null; qty: number; unitCostOverride?: number | null; name?: string; unit?: string }>
  errorRateOverride?: number | null
  marginPercentOverride?: number | null
}

export type ResolveAndCalculateOutput = {
  result: PricingCalculationResult
  snapshots: {
    filamentPricePerKgSnapshot: number
    energyCostPerHourSnapshot: number
    depreciationPerHourSnapshot: number
    errorRate: number
    marginPercent: number
    componentsSnapshot: Array<{
      componentId: string | null
      name: string
      unit: string
      qty: number
      unitCostSnapshot: number
      total: number
    }>
  }
  warnings: string[]
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Lookup do PricingSettings singleton (1 linha). Lanca se ausente — a
 * migration cria o singleton, ausencia indica banco corrompido.
 */
export async function getPricingSettings() {
  if (!hasDatabase || !(prisma as any)?.pricingSettings) {
    throw new ValidationError('Banco de dados indisponivel')
  }
  const settings = await (prisma as any).pricingSettings.findUnique({
    where: { id: 'singleton' },
  })
  if (!settings) {
    throw new ValidationError('PricingSettings singleton ausente. Migration nao rodou?')
  }
  return {
    defaultEnergyCostPerHour: Number(settings.defaultEnergyCostPerHour),
    defaultDepreciationPerHour: Number(settings.defaultDepreciationPerHour),
    defaultErrorRate: Number(settings.defaultErrorRate),
    energyTariffPerKwh: Number(settings.energyTariffPerKwh),
    marginTiers: settings.marginTiersJson as PricingTier[],
  }
}

/**
 * Resolve as FKs (filament, printer, components), monta o input da
 * calculadora pura, executa o calculo e devolve resultado + snapshots
 * congelaveis. Tambem aplica fallback de sugestao de margem por faixa
 * quando marginPercentOverride nao vem.
 */
export async function resolveAndCalculate(
  input: ResolveAndCalculateInput,
): Promise<ResolveAndCalculateOutput> {
  const warnings: string[] = []

  // Validacao basica
  if (!Number.isFinite(input.filamentGrams) || input.filamentGrams <= 0) {
    throw new ValidationError('filamentGrams deve ser > 0')
  }
  if (!Number.isFinite(input.printHours) || input.printHours <= 0) {
    throw new ValidationError('printHours deve ser > 0')
  }

  // 1. Resolve filamento
  let filamentPricePerKg: number
  if (input.filamentId) {
    if (!hasDatabase || !(prisma as any)?.filament) {
      throw new ValidationError('Banco de dados indisponivel')
    }
    const filament = await (prisma as any).filament.findUnique({
      where: { id: input.filamentId },
    })
    if (!filament) throw new ValidationError(`Filamento ${input.filamentId} nao encontrado`)
    filamentPricePerKg = Number(filament.pricePerKg)
  } else if (input.filamentPricePerKgOverride != null && input.filamentPricePerKgOverride > 0) {
    filamentPricePerKg = Number(input.filamentPricePerKgOverride)
  } else {
    throw new ValidationError(
      'Informe filamentId ou filamentPricePerKgOverride (preco em R$/kg)',
    )
  }

  // 2. Resolve impressora (opcional)
  let printerWatts: number | null = null
  let printerAcquisition: number | null = null
  let printerLifetimeHours: number | null = null
  if (input.printerId) {
    if (!hasDatabase || !(prisma as any)?.printer) {
      throw new ValidationError('Banco de dados indisponivel')
    }
    const printer = await (prisma as any).printer.findUnique({
      where: { id: input.printerId },
    })
    if (!printer) throw new ValidationError(`Impressora ${input.printerId} nao encontrada`)
    printerWatts = printer.powerConsumptionWatts ?? null
    printerAcquisition = printer.acquisitionCostBRL != null ? Number(printer.acquisitionCostBRL) : null
    printerLifetimeHours = printer.lifetimeHours ?? null
    if (printerWatts == null) {
      warnings.push(`Impressora ${printer.name} sem powerConsumptionWatts — usando energia default`)
    }
    if (printerAcquisition == null || printerLifetimeHours == null || printerLifetimeHours <= 0) {
      warnings.push(`Impressora ${printer.name} sem dados de depreciacao — usando default`)
    }
  }

  // 3. Resolve componentes (lookup ou usa override)
  const settings = await getPricingSettings()
  const componentsSnapshot: ResolveAndCalculateOutput['snapshots']['componentsSnapshot'] = []
  for (const [i, c] of input.components.entries()) {
    let name = c.name ?? ''
    let unit = c.unit ?? 'un'
    let unitCost: number
    if (c.componentId) {
      if (!hasDatabase || !(prisma as any)?.component) {
        throw new ValidationError('Banco de dados indisponivel')
      }
      const comp = await (prisma as any).component.findUnique({ where: { id: c.componentId } })
      if (!comp) throw new ValidationError(`Componente ${c.componentId} nao encontrado`)
      name = comp.name
      unit = comp.unit
      unitCost = c.unitCostOverride != null && c.unitCostOverride >= 0
        ? Number(c.unitCostOverride)
        : Number(comp.costPerUnit)
    } else {
      if (!name) throw new ValidationError(`Componente avulso [${i}] precisa de name`)
      if (c.unitCostOverride == null) {
        throw new ValidationError(`Componente avulso [${i}] precisa de unitCostOverride`)
      }
      unitCost = Number(c.unitCostOverride)
    }
    if (!Number.isFinite(c.qty) || c.qty <= 0) {
      throw new ValidationError(`Componente [${i}] qty deve ser > 0`)
    }
    componentsSnapshot.push({
      componentId: c.componentId ?? null,
      name,
      unit,
      qty: c.qty,
      unitCostSnapshot: unitCost,
      total: Math.round(c.qty * unitCost * 100) / 100,
    })
  }

  // 4. Resolve errorRate
  const errorRate =
    input.errorRateOverride != null
      ? Number(input.errorRateOverride)
      : settings.defaultErrorRate
  if (errorRate < 0 || errorRate > 1) {
    throw new ValidationError('errorRate deve estar entre 0 e 1 (ex.: 0.30)')
  }

  // 5. Snapshots dos custos energia/depreciacao (rate por hora aplicado)
  const energyCostPerHourSnapshot =
    printerWatts != null && printerWatts > 0
      ? (printerWatts / 1000) * settings.energyTariffPerKwh
      : settings.defaultEnergyCostPerHour
  const depreciationPerHourSnapshot =
    printerAcquisition != null && printerLifetimeHours != null && printerLifetimeHours > 0
      ? printerAcquisition / printerLifetimeHours
      : settings.defaultDepreciationPerHour

  // 6. Componentes para a calculadora
  const calcComponents: PricingComponentInput[] = componentsSnapshot.map(c => ({
    componentId: c.componentId,
    name: c.name,
    unit: c.unit,
    qty: c.qty,
    unitCostSnapshot: c.unitCostSnapshot,
  }))

  // 7. Calculo inicial com margem 0 só pra descobrir costTotal e sugerir margem
  const interim = calculate({
    filamentGrams: input.filamentGrams,
    filamentPricePerKg,
    printHours: input.printHours,
    printerWatts,
    printerAcquisition,
    printerLifetimeHours,
    energyTariffPerKwh: settings.energyTariffPerKwh,
    defaultEnergyPerHour: settings.defaultEnergyCostPerHour,
    defaultDeprecPerHour: settings.defaultDepreciationPerHour,
    errorRate,
    components: calcComponents,
    marginPercent: 0,
  })

  // 8. Margin aplicado: override do client OU sugestao por faixa
  let marginPercent: number
  if (input.marginPercentOverride != null) {
    marginPercent = Number(input.marginPercentOverride)
    if (marginPercent < 0 || marginPercent > 10) {
      throw new ValidationError('marginPercent deve estar entre 0 e 10 (ex.: 0.60 = 60%)')
    }
  } else {
    marginPercent = findSuggestedMargin(interim.costTotal, settings.marginTiers)
  }

  // 9. Calculo final com margem aplicada
  const result = calculate({
    filamentGrams: input.filamentGrams,
    filamentPricePerKg,
    printHours: input.printHours,
    printerWatts,
    printerAcquisition,
    printerLifetimeHours,
    energyTariffPerKwh: settings.energyTariffPerKwh,
    defaultEnergyPerHour: settings.defaultEnergyCostPerHour,
    defaultDeprecPerHour: settings.defaultDepreciationPerHour,
    errorRate,
    components: calcComponents,
    marginPercent,
  })

  return {
    result,
    snapshots: {
      filamentPricePerKgSnapshot: filamentPricePerKg,
      energyCostPerHourSnapshot,
      depreciationPerHourSnapshot,
      errorRate,
      marginPercent,
      componentsSnapshot,
    },
    warnings,
  }
}

/**
 * Serializa PricingEstimate (com Decimal/Date) em DTO JSON-friendly.
 */
export function serializeEstimate(row: any) {
  const num = (d: Prisma.Decimal | number | null | undefined): number => {
    if (d === null || d === undefined) return 0
    if (typeof d === 'number') return d
    return Number(d.toString())
  }
  const numOrNull = (d: Prisma.Decimal | number | null | undefined): number | null => {
    if (d === null || d === undefined) return null
    if (typeof d === 'number') return d
    return Number(d.toString())
  }
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    productId: row.productId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    notes: row.notes,
    quantity: row.quantity,
    filamentId: row.filamentId,
    filamentGrams: num(row.filamentGrams),
    printHours: num(row.printHours),
    printerId: row.printerId,
    components: (row.componentsJson as any[]) || [],
    filamentPricePerKgSnapshot: num(row.filamentPricePerKgSnapshot),
    energyCostPerHourSnapshot: num(row.energyCostPerHourSnapshot),
    depreciationPerHourSnapshot: num(row.depreciationPerHourSnapshot),
    errorRate: num(row.errorRate),
    marginPercent: num(row.marginPercent),
    costFilament: num(row.costFilament),
    costEnergy: num(row.costEnergy),
    costDepreciation: num(row.costDepreciation),
    costError: num(row.costError),
    costComponents: num(row.costComponents),
    costTotal: num(row.costTotal),
    suggestedPrice: num(row.suggestedPrice),
    finalPrice: numOrNull(row.finalPrice),
    convertedToOrderId: row.convertedToOrderId,
    convertedAt: row.convertedAt instanceof Date ? row.convertedAt.toISOString() : row.convertedAt,
    createdByEmail: row.createdByEmail,
    updatedByEmail: row.updatedByEmail,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}
