import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB, type PrinterRecord } from '@/lib/localDb'

export type PrinterStatus = 'active' | 'maintenance' | 'offline'
const VALID_STATUSES: PrinterStatus[] = ['active', 'maintenance', 'offline']

export type PrinterDto = {
  id: string
  name: string
  model: string | null
  buildVolume: string | null
  materials: string | null
  dailyCapacityMinutes: number
  status: PrinterStatus
  color: string | null
  notes: string | null
  /** Consumo em watts. Usado pra calcular custo de energia. */
  powerConsumptionWatts: number | null
  /** Preço pago na impressora (R$). Usado pra calcular depreciação. */
  acquisitionCostBRL: number | null
  /** Vida útil em horas (ex.: 5000). Depreciação por hora = aquisição / horas. */
  lifetimeHours: number | null
  createdAt: string
  updatedAt: string
}

const printerClient = (): any => (prisma as any)?.printer

function decimalToNumber(value: any): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  // Prisma Decimal tem toString
  return Number(value.toString())
}

function serialize(p: any): PrinterDto {
  return {
    id: p.id,
    name: p.name,
    model: p.model || null,
    buildVolume: p.buildVolume || null,
    materials: p.materials || null,
    dailyCapacityMinutes: typeof p.dailyCapacityMinutes === 'number' ? p.dailyCapacityMinutes : 480,
    status: (p.status as PrinterStatus) || 'active',
    color: p.color || null,
    notes: p.notes || null,
    powerConsumptionWatts: typeof p.powerConsumptionWatts === 'number' ? p.powerConsumptionWatts : null,
    acquisitionCostBRL: decimalToNumber(p.acquisitionCostBRL),
    lifetimeHours: typeof p.lifetimeHours === 'number' ? p.lifetimeHours : null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  }
}

export type PrinterInput = {
  name: string
  model?: string | null
  buildVolume?: string | null
  materials?: string | null
  dailyCapacityMinutes?: number
  status?: PrinterStatus
  color?: string | null
  notes?: string | null
  powerConsumptionWatts?: number | null
  acquisitionCostBRL?: number | null
  lifetimeHours?: number | null
}

function nonNegIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.floor(num)
}

function nonNegDecimalOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 100) / 100
}

function sanitize(input: PrinterInput) {
  const name = String(input.name || '').trim().slice(0, 80)
  const cap = Number.isFinite(Number(input.dailyCapacityMinutes)) ? Math.max(0, Math.min(60 * 24 * 30, Math.round(Number(input.dailyCapacityMinutes)))) : 480
  const status: PrinterStatus = input.status && VALID_STATUSES.includes(input.status) ? input.status : 'active'
  return {
    name,
    model: input.model?.trim() || null,
    buildVolume: input.buildVolume?.trim() || null,
    materials: input.materials?.trim() || null,
    dailyCapacityMinutes: cap,
    status,
    color: input.color?.trim() || null,
    notes: input.notes?.trim() || null,
    powerConsumptionWatts: nonNegIntOrNull(input.powerConsumptionWatts),
    acquisitionCostBRL: nonNegDecimalOrNull(input.acquisitionCostBRL),
    lifetimeHours: nonNegIntOrNull(input.lifetimeHours),
  }
}

export async function listPrinters(): Promise<PrinterDto[]> {
  if (!hasDatabase || !printerClient()) {
    return ((readDB().printers || []) as PrinterRecord[]).map(serialize)
  }
  try {
    const records = await printerClient().findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] })
    return records.map(serialize)
  } catch (error) {
    console.error('[printers] listPrinters failed:', error)
    return []
  }
}

export async function getPrinterById(id: string): Promise<PrinterDto | null> {
  if (!id) return null
  if (!hasDatabase || !printerClient()) {
    const found = (readDB().printers || []).find(p => p.id === id)
    return found ? serialize(found) : null
  }
  try {
    const record = await printerClient().findUnique({ where: { id } })
    return record ? serialize(record) : null
  } catch (error) {
    console.error('[printers] getPrinterById failed:', error)
    return null
  }
}

export async function createPrinter(input: PrinterInput): Promise<{ ok: boolean; printer?: PrinterDto; error?: string }> {
  const data = sanitize(input)
  if (!data.name) return { ok: false, error: 'Nome é obrigatório.' }

  if (!hasDatabase || !printerClient()) {
    const db = readDB()
    db.printers = db.printers || []
    const now = new Date().toISOString()
    const record: PrinterRecord = { id: `printer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...data, createdAt: now, updatedAt: now }
    db.printers.push(record)
    writeDB(db)
    return { ok: true, printer: serialize(record) }
  }
  try {
    const created = await printerClient().create({ data })
    return { ok: true, printer: serialize(created) }
  } catch (error) {
    console.error('[printers] createPrinter failed:', error)
    return { ok: false, error: 'persist_failed' }
  }
}

export async function updatePrinter(id: string, input: Partial<PrinterInput>): Promise<{ ok: boolean; printer?: PrinterDto; error?: string }> {
  if (!id) return { ok: false, error: 'invalid_input' }
  const partial: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = String(input.name).trim().slice(0, 80)
    if (!name) return { ok: false, error: 'Nome é obrigatório.' }
    partial.name = name
  }
  if (input.model !== undefined) partial.model = input.model?.trim() || null
  if (input.buildVolume !== undefined) partial.buildVolume = input.buildVolume?.trim() || null
  if (input.materials !== undefined) partial.materials = input.materials?.trim() || null
  if (input.color !== undefined) partial.color = input.color?.trim() || null
  if (input.notes !== undefined) partial.notes = input.notes?.trim() || null
  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status as PrinterStatus)) return { ok: false, error: 'status inválido.' }
    partial.status = input.status
  }
  if (input.dailyCapacityMinutes !== undefined) {
    const cap = Number(input.dailyCapacityMinutes)
    if (!Number.isFinite(cap) || cap < 0) return { ok: false, error: 'Capacidade inválida.' }
    partial.dailyCapacityMinutes = Math.round(Math.min(60 * 24 * 30, cap))
  }
  if (input.powerConsumptionWatts !== undefined) {
    partial.powerConsumptionWatts = nonNegIntOrNull(input.powerConsumptionWatts)
  }
  if (input.acquisitionCostBRL !== undefined) {
    partial.acquisitionCostBRL = nonNegDecimalOrNull(input.acquisitionCostBRL)
  }
  if (input.lifetimeHours !== undefined) {
    partial.lifetimeHours = nonNegIntOrNull(input.lifetimeHours)
  }

  if (!hasDatabase || !printerClient()) {
    const db = readDB()
    const idx = (db.printers || []).findIndex(p => p.id === id)
    if (idx === -1) return { ok: false, error: 'not_found' }
    const next: PrinterRecord = { ...db.printers[idx], ...(partial as any), updatedAt: new Date().toISOString() }
    db.printers[idx] = next
    writeDB(db)
    return { ok: true, printer: serialize(next) }
  }
  try {
    const updated = await printerClient().update({ where: { id }, data: partial })
    return { ok: true, printer: serialize(updated) }
  } catch (error) {
    console.error('[printers] updatePrinter failed:', error)
    return { ok: false, error: 'persist_failed' }
  }
}

export async function deletePrinter(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: 'invalid_input' }

  if (!hasDatabase || !printerClient()) {
    const db = readDB()
    const before = (db.printers || []).length
    db.printers = (db.printers || []).filter(p => p.id !== id)
    if (db.printers.length === before) return { ok: false, error: 'not_found' }
    db.productionTasks = (db.productionTasks || []).map(t => t.orderId && (t as any).printerId === id ? { ...t, printerId: null } as any : t)
    writeDB(db)
    return { ok: true }
  }
  try {
    // ProductionTask.printerId vira NULL via FK ON DELETE SET NULL.
    await printerClient().delete({ where: { id } })
    return { ok: true }
  } catch (error) {
    console.error('[printers] deletePrinter failed:', error)
    return { ok: false, error: 'persist_failed' }
  }
}

export async function assignTaskToPrinter(taskId: string, printerId: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!taskId) return { ok: false, error: 'invalid_input' }

  if (!hasDatabase || !prisma?.productionTask) {
    const db = readDB()
    const idx = (db.productionTasks || []).findIndex(t => t.id === taskId)
    if (idx === -1) return { ok: false, error: 'not_found' }
    if (printerId) {
      const exists = (db.printers || []).some(p => p.id === printerId)
      if (!exists) return { ok: false, error: 'printer_not_found' }
    }
    ;(db.productionTasks[idx] as any).printerId = printerId
    db.productionTasks[idx].updatedAt = new Date().toISOString()
    writeDB(db)
    return { ok: true }
  }

  try {
    if (printerId) {
      const printer = await printerClient()?.findUnique({ where: { id: printerId }, select: { id: true } })
      if (!printer) return { ok: false, error: 'printer_not_found' }
    }
    await prisma.productionTask.update({ where: { id: taskId }, data: { printerId: printerId } })
    return { ok: true }
  } catch (error) {
    console.error('[printers] assignTaskToPrinter failed:', error)
    return { ok: false, error: 'persist_failed' }
  }
}
