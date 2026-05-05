// SPEC-002: helpers de preço/descrição de variação compartilhados entre o
// site público (ProductDetailClient) e o admin (modais de pedido). DRY para
// evitar divergência futura entre o cálculo de preço efetivo no checkout e na
// criação manual de pedido.

export type VariantPricingInput = {
  priceDelta?: number | null
  priceOverride?: number | null
}

export type VariantDescribeInput = {
  name?: string | null
  color?: string | null
  size?: string | null
  material?: string | null
  finish?: string | null
}

/**
 * Preço efetivo de uma linha de pedido considerando override e delta da
 * variação. Se variant for null, devolve o preço base do produto.
 */
export function variantEffectivePrice(
  basePrice: number,
  variant: VariantPricingInput | null | undefined,
): number {
  if (!variant) return basePrice
  if (variant.priceOverride != null) return Number(variant.priceOverride)
  return basePrice + Number(variant.priceDelta || 0)
}

/**
 * Rótulo legível para a variação. Prioriza atributos preenchidos
 * (color/size/material/finish). Cai no name se nenhum estiver disponível ou
 * se o name não for o "Padrão" genérico.
 */
export function describeVariant(variant: VariantDescribeInput): string {
  const parts = [variant.color, variant.size, variant.material, variant.finish].filter(
    (value): value is string => Boolean(value && value.trim()),
  )
  if (parts.length === 0) return variant.name || 'Padrão'
  const composed = parts.join(' - ')
  return variant.name && variant.name.trim() && variant.name !== 'Padrao' && variant.name !== 'Padrão'
    ? variant.name
    : composed
}
