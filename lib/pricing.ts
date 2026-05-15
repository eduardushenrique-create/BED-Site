/**
 * SPEC-007 §4 — calculadora canonica de precificacao.
 *
 * Funcao pura, sem I/O. Backend (POST /api/orcamentos) e dry-run da UI
 * (POST /api/orcamentos/calcular) devem produzir EXATAMENTE os mesmos
 * numeros para o mesmo input.
 *
 * Trabalha em `number` (JS double). Os erros de ponto flutuante sao
 * tolerados porque arredondamos para 2 casas (half-up) no final — mesmo
 * comportamento que a planilha Excel original do stakeholder.
 *
 * Para persistencia, o endpoint converte os results para Prisma.Decimal
 * com a precisao definida no schema (10,2 para R$, 10,4 para R$/h e %).
 */

export type PricingTier = {
  /** Custo total maximo (exclusivo) para esta faixa. NULL = "acima de tudo". */
  maxCost: number | null
  /** Margem aplicada nesta faixa. Ex.: 0.60 = 60%. */
  marginPercent: number
}

export type PricingComponentInput = {
  /** ID do Component cadastrado, NULL para componente avulso. */
  componentId?: string | null
  /** Nome do componente — sempre snapshot, nunca lookup. */
  name: string
  /** Unidade (un, m, kg). Snapshot. */
  unit: string
  /** Quantidade usada. */
  qty: number
  /** Custo unitario no momento do snapshot. */
  unitCostSnapshot: number
}

export type PricingCalculationInput = {
  // Filamento
  filamentGrams: number
  filamentPricePerKg: number

  // Impressao
  printHours: number

  // Impressora (opcional — usa defaults quando ausente)
  printerWatts?: number | null
  printerAcquisition?: number | null
  printerLifetimeHours?: number | null

  // Defaults globais (de PricingSettings)
  energyTariffPerKwh: number
  defaultEnergyPerHour: number
  defaultDeprecPerHour: number

  // Parametros do calculo
  errorRate: number // 0..1 (ex. 0.30 = 30%)
  components: PricingComponentInput[]
  marginPercent: number // 0..N (ex. 0.60 = 60%)
}

export type PricingCalculationResult = {
  // Breakdown de custos (todos em R$, arredondados a 2 casas)
  costFilament: number
  costEnergy: number
  costDepreciation: number
  costError: number
  costComponents: number
  costTotal: number

  // Preco sugerido (custo * (1 + margem)), arredondado a 2 casas
  suggestedPrice: number

  // Indicadores do que foi efetivamente aplicado (transparencia)
  energySource: 'printer' | 'default'
  depreciationSource: 'printer' | 'default'
}

/**
 * Arredondamento "half-up" para n casas decimais. JavaScript usa "half to
 * even" por padrao em `Math.round`, que diverge da planilha do stakeholder.
 *
 *   roundHalfUp(0.125, 2) -> 0.13  (half-up)
 *   (0.125).toFixed(2)    -> "0.12" (half to even)
 */
export function roundHalfUp(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  // O `+ Number.EPSILON` compensa erros de ponto flutuante perto da metade.
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Sugere margem baseada no custo total usando faixas (tier-based).
 * Tiers devem estar ordenados por `maxCost` asc (NULL ao final).
 * Retorna a margem da PRIMEIRA faixa cujo maxCost cobre o costTotal,
 * ou a margem default da ultima faixa (maxCost=null) se nenhuma cobrir.
 *
 * Exemplo com tiers default da SPEC-007:
 *   findSuggestedMargin(10, tiers)  -> 1.00 (100% pra peca barata)
 *   findSuggestedMargin(30, tiers)  -> 0.60 (60% media)
 *   findSuggestedMargin(80, tiers)  -> 0.50 (50% alta)
 *   findSuggestedMargin(500, tiers) -> 0.40 (40% pecas grandes)
 */
export function findSuggestedMargin(costTotal: number, tiers: PricingTier[]): number {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    // Fallback defensivo — sem tiers configurados, 60% media razoavel.
    return 0.6
  }
  // Ordena por maxCost asc, NULL ao final (defensivo — endpoint valida estrutura).
  const sorted = [...tiers].sort((a, b) => {
    if (a.maxCost === null) return 1
    if (b.maxCost === null) return -1
    return a.maxCost - b.maxCost
  })
  for (const tier of sorted) {
    if (tier.maxCost === null || costTotal <= tier.maxCost) {
      return tier.marginPercent
    }
  }
  // Nunca alcanca, mas o TS exige retorno. Cai na ultima margem.
  return sorted[sorted.length - 1]?.marginPercent ?? 0.6
}

/**
 * Calcula o custo e o preco sugerido seguindo a formula canonica da SPEC-007 §4.
 *
 * Decisoes que diferem do calculo "ingenuo":
 *
 * 1. Custo de energia usa Printer.powerConsumptionWatts quando cadastrado
 *    (kWh-based, mais preciso). Caso contrario cai no default global (R$/h).
 *
 * 2. Depreciacao usa Printer.acquisitionCostBRL/lifetimeHours quando AMBOS
 *    cadastrados E lifetimeHours > 0. Caso contrario cai no default global.
 *
 * 3. Taxa de erro aplica-se SO sobre o custo de filamento (cosumivel descartavel
 *    em peca quebrada — bate com a planilha do stakeholder).
 *
 * 4. Arredondamento half-up para 2 casas em cada subcusto antes de somar
 *    (bate exatamente com a planilha; alternativa de arredondar so no final
 *    da divergencia de 1-2 centavos).
 */
export function calculate(input: PricingCalculationInput): PricingCalculationResult {
  const {
    filamentGrams,
    filamentPricePerKg,
    printHours,
    printerWatts,
    printerAcquisition,
    printerLifetimeHours,
    energyTariffPerKwh,
    defaultEnergyPerHour,
    defaultDeprecPerHour,
    errorRate,
    components,
    marginPercent,
  } = input

  // 1. Filamento (gramas * preco/g)
  const pricePerGram = filamentPricePerKg / 1000
  const costFilament = roundHalfUp(pricePerGram * filamentGrams, 2)

  // 2. Energia
  let costEnergy: number
  let energySource: 'printer' | 'default'
  if (printerWatts != null && printerWatts > 0) {
    costEnergy = roundHalfUp(
      (printerWatts / 1000) * energyTariffPerKwh * printHours,
      2,
    )
    energySource = 'printer'
  } else {
    costEnergy = roundHalfUp(defaultEnergyPerHour * printHours, 2)
    energySource = 'default'
  }

  // 3. Depreciacao
  let costDepreciation: number
  let depreciationSource: 'printer' | 'default'
  if (
    printerAcquisition != null &&
    printerLifetimeHours != null &&
    printerLifetimeHours > 0
  ) {
    costDepreciation = roundHalfUp(
      (printerAcquisition / printerLifetimeHours) * printHours,
      2,
    )
    depreciationSource = 'printer'
  } else {
    costDepreciation = roundHalfUp(defaultDeprecPerHour * printHours, 2)
    depreciationSource = 'default'
  }

  // 4. Taxa de erro — % sobre filamento (consumivel descartado em peca quebrada)
  const costError = roundHalfUp(costFilament * errorRate, 2)

  // 5. Componentes — soma qty * unitCost de cada
  const costComponents = roundHalfUp(
    components.reduce((sum, c) => sum + c.qty * c.unitCostSnapshot, 0),
    2,
  )

  // 6. Custo total
  const costTotal = roundHalfUp(
    costFilament + costEnergy + costDepreciation + costError + costComponents,
    2,
  )

  // 7. Preco sugerido — custo * (1 + margem)
  const suggestedPrice = roundHalfUp(costTotal * (1 + marginPercent), 2)

  return {
    costFilament,
    costEnergy,
    costDepreciation,
    costError,
    costComponents,
    costTotal,
    suggestedPrice,
    energySource,
    depreciationSource,
  }
}
