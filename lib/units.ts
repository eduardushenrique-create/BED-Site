/**
 * Unidades de medida válidas para Component (SPEC-001).
 *
 * Combo fixo conforme decisão do stakeholder em 2026-05-03 (Q1 da spec).
 * Sem texto livre — evita "kg" vs "Kg" virarem unidades diferentes.
 *
 * Pra adicionar uma nova unidade:
 *   1. Acrescentar aqui
 *   2. Atualizar o enum no front (UnitOption no /admin/componentes)
 *   3. Não precisa migration: o campo no banco é TEXT
 */
export const COMPONENT_UNITS = ['un', 'm', 'kg', 'g', 'L', 'ml'] as const

export type ComponentUnit = (typeof COMPONENT_UNITS)[number]

export function isValidUnit(value: unknown): value is ComponentUnit {
  return typeof value === 'string' && (COMPONENT_UNITS as readonly string[]).includes(value)
}

export function unitLabel(unit: string): string {
  switch (unit) {
    case 'un':
      return 'unidade'
    case 'm':
      return 'metro'
    case 'kg':
      return 'quilograma'
    case 'g':
      return 'grama'
    case 'L':
      return 'litro'
    case 'ml':
      return 'mililitro'
    default:
      return unit
  }
}
