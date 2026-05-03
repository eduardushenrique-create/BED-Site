import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { Prisma } from '@prisma/client'
import { captureException } from '@/lib/observability'

/**
 * Tipos de filamento aceitos. Combo fixo conforme requisição do
 * stakeholder. "Other" coberto pelo valor 'OTHER' (texto livre fica
 * no campo `notes`).
 */
export const FILAMENT_TYPES = ['PLA', 'PETG', 'TPU', 'ABS', 'PETG-HF', 'PLA-Speed+', 'OTHER'] as const

export type FilamentType = (typeof FILAMENT_TYPES)[number]

export function isValidFilamentType(value: unknown): value is FilamentType {
  return typeof value === 'string' && (FILAMENT_TYPES as readonly string[]).includes(value)
}

export function filamentTypeLabel(type: string): string {
  return type === 'OTHER' ? 'Outro' : type
}

export interface SerializedFilament {
  id: string
  name: string
  brand: string | null
  type: string
  pricePerKg: number
  /** Calculado em runtime: pricePerKg / 1000. Quando a UI mostra "custo/g". */
  pricePerGram: number
  /** Hex string formato #RRGGBB. Null = sem cor cadastrada. */
  colorHex: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Aceita "#RRGGBB" ou "RRGGBB" (case-insensitive). Retorna null pra qualquer outra coisa. */
function normalizeColorHex(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9a-f]{6}$/i.test(withHash)) return null
  return withHash.toUpperCase()
}

function toNum(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function serialize(row: {
  id: string
  name: string
  brand: string | null
  type: string
  pricePerKg: Prisma.Decimal
  colorHex: string | null
  notes: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): SerializedFilament {
  const pricePerKg = toNum(row.pricePerKg)
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    type: row.type,
    pricePerKg,
    // Cálculo em runtime — evita reescrever quando o admin reajusta o preço.
    pricePerGram: Math.round((pricePerKg / 1000) * 10000) / 10000,
    colorHex: row.colorHex,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export interface FilamentInput {
  name: string
  brand?: string | null
  type: string
  pricePerKg: number
  colorHex?: string | null
  notes?: string | null
  isActive?: boolean
}

function validate(input: FilamentInput): string | null {
  if (!input.name?.trim()) return 'Nome é obrigatório.'
  if (!isValidFilamentType(input.type)) return 'Tipo de filamento inválido.'
  if (!Number.isFinite(input.pricePerKg) || input.pricePerKg < 0) {
    return 'Custo por kilo precisa ser um número não-negativo.'
  }
  return null
}

export async function listFilaments(options: { onlyActive?: boolean; type?: string } = {}): Promise<SerializedFilament[]> {
  if (!hasDatabase || !prisma?.filament) return []
  const where: Prisma.FilamentWhereInput = {}
  if (options.onlyActive) where.isActive = true
  if (options.type) where.type = options.type
  const rows = await prisma.filament.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })
  return rows.map(serialize)
}

export async function getFilament(id: string): Promise<SerializedFilament | null> {
  if (!hasDatabase || !prisma?.filament) return null
  const row = await prisma.filament.findUnique({ where: { id } })
  return row ? serialize(row) : null
}

export async function createFilament(input: FilamentInput): Promise<{ filament?: SerializedFilament; error?: string }> {
  if (!hasDatabase || !prisma?.filament) return { error: 'Banco indisponível.' }
  const error = validate(input)
  if (error) return { error }
  try {
    const row = await prisma.filament.create({
      data: {
        name: input.name.trim(),
        brand: input.brand?.trim() || null,
        type: input.type,
        pricePerKg: input.pricePerKg,
        colorHex: normalizeColorHex(input.colorHex),
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true,
      },
    })
    return { filament: serialize(row) }
  } catch (err) {
    captureException(err, { context: 'filaments', detail: 'create failed' })
    return { error: 'Erro ao criar filamento.' }
  }
}

export async function updateFilament(
  id: string,
  input: Partial<FilamentInput>,
): Promise<{ filament?: SerializedFilament; error?: string }> {
  if (!hasDatabase || !prisma?.filament) return { error: 'Banco indisponível.' }
  if (input.type !== undefined && !isValidFilamentType(input.type)) {
    return { error: 'Tipo de filamento inválido.' }
  }
  if (input.name !== undefined && !input.name.trim()) {
    return { error: 'Nome é obrigatório.' }
  }
  if (input.pricePerKg !== undefined && (!Number.isFinite(input.pricePerKg) || input.pricePerKg < 0)) {
    return { error: 'Custo por kilo precisa ser um número não-negativo.' }
  }
  try {
    const data: Prisma.FilamentUpdateInput = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.brand !== undefined) data.brand = input.brand?.trim() || null
    if (input.type !== undefined) data.type = input.type
    if (input.pricePerKg !== undefined) data.pricePerKg = input.pricePerKg
    if (input.colorHex !== undefined) data.colorHex = normalizeColorHex(input.colorHex)
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null
    if (input.isActive !== undefined) data.isActive = input.isActive

    const row = await prisma.filament.update({ where: { id }, data })
    return { filament: serialize(row) }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return { error: 'Filamento não encontrado.' }
    }
    captureException(err, { context: 'filaments', detail: 'update failed' })
    return { error: 'Erro ao atualizar filamento.' }
  }
}

export async function deleteFilament(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.filament) return { ok: false, error: 'Banco indisponível.' }
  try {
    await prisma.filament.delete({ where: { id } })
    return { ok: true }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return { ok: false, error: 'Filamento não encontrado.' }
    }
    if ((err as { code?: string }).code === 'P2003') {
      return { ok: false, error: 'Filamento está em uso por algum produto. Remova o vínculo antes.' }
    }
    captureException(err, { context: 'filaments', detail: 'delete failed' })
    return { ok: false, error: 'Erro ao excluir filamento.' }
  }
}
