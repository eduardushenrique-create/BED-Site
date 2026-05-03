import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { Prisma } from '@prisma/client'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'
import { isValidUnit } from '@/lib/units'

const log = createLogger({ component: 'components-stock' })

export type StockMovementType = 'in' | 'out' | 'adjust' | 'reverse'

const MOVEMENT_TYPES: StockMovementType[] = ['in', 'out', 'adjust', 'reverse']

export interface ComponentInput {
  sku?: string | null
  name: string
  description?: string | null
  unit: string
  stock?: number
  lowStockThreshold?: number | null
  supplier?: string | null
  supplierUrl?: string | null
  costPerUnit?: number | null
  notes?: string | null
  isActive?: boolean
}

export interface SerializedComponent {
  id: string
  sku: string | null
  name: string
  description: string | null
  unit: string
  stock: number
  lowStockThreshold: number | null
  supplier: string | null
  supplierUrl: string | null
  costPerUnit: number | null
  notes: string | null
  isActive: boolean
  isLow: boolean
  createdAt: string
  updatedAt: string
}

export interface SerializedStockMovement {
  id: string
  componentId: string
  type: StockMovementType
  quantity: number
  balanceAfter: number
  reason: string | null
  relatedTaskId: string | null
  relatedOrderNumber: string | null
  createdByEmail: string | null
  createdAt: string
}

function toNum(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function toNumOrNull(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return typeof value === 'number' ? value : Number(value.toString())
}

function serializeComponent(row: {
  id: string
  sku: string | null
  name: string
  description: string | null
  unit: string
  stock: Prisma.Decimal
  lowStockThreshold: Prisma.Decimal | null
  supplier: string | null
  supplierUrl: string | null
  costPerUnit: Prisma.Decimal | null
  notes: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): SerializedComponent {
  const stock = toNum(row.stock)
  const threshold = toNumOrNull(row.lowStockThreshold)
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    unit: row.unit,
    stock,
    lowStockThreshold: threshold,
    supplier: row.supplier,
    supplierUrl: row.supplierUrl,
    costPerUnit: toNumOrNull(row.costPerUnit),
    notes: row.notes,
    isActive: row.isActive,
    // Sem threshold definido = nunca está em "baixa" (admin não pediu alerta).
    isLow: threshold !== null && stock <= threshold,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeMovement(row: {
  id: string
  componentId: string
  type: string
  quantity: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  reason: string | null
  relatedTaskId: string | null
  relatedOrderNumber: string | null
  createdByEmail: string | null
  createdAt: Date
}): SerializedStockMovement {
  return {
    id: row.id,
    componentId: row.componentId,
    type: (MOVEMENT_TYPES.includes(row.type as StockMovementType) ? row.type : 'adjust') as StockMovementType,
    quantity: toNum(row.quantity),
    balanceAfter: toNum(row.balanceAfter),
    reason: row.reason,
    relatedTaskId: row.relatedTaskId,
    relatedOrderNumber: row.relatedOrderNumber,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listComponents(options: {
  search?: string
  onlyLow?: boolean
  onlyActive?: boolean
} = {}): Promise<SerializedComponent[]> {
  if (!hasDatabase || !prisma?.component) return []
  const where: Prisma.ComponentWhereInput = {}
  if (options.onlyActive) where.isActive = true
  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: 'insensitive' } },
      { sku: { contains: options.search, mode: 'insensitive' } },
    ]
  }
  const rows = await prisma.component.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })
  const list = rows.map(serializeComponent)
  return options.onlyLow ? list.filter(c => c.isLow) : list
}

export async function getComponent(id: string): Promise<SerializedComponent | null> {
  if (!hasDatabase || !prisma?.component) return null
  const row = await prisma.component.findUnique({ where: { id } })
  return row ? serializeComponent(row) : null
}

function validateInput(input: ComponentInput): string | null {
  if (!input.name?.trim()) return 'Nome é obrigatório.'
  if (!input.unit || !isValidUnit(input.unit)) return 'Unidade inválida.'
  if (input.stock !== undefined && (Number.isNaN(input.stock) || input.stock < 0)) {
    return 'Estoque não pode ser negativo.'
  }
  if (
    input.lowStockThreshold !== undefined &&
    input.lowStockThreshold !== null &&
    (Number.isNaN(input.lowStockThreshold) || input.lowStockThreshold < 0)
  ) {
    return 'Limite mínimo não pode ser negativo.'
  }
  return null
}

export async function createComponent(input: ComponentInput): Promise<{ component?: SerializedComponent; error?: string }> {
  if (!hasDatabase || !prisma?.component) return { error: 'Banco indisponível.' }
  const error = validateInput(input)
  if (error) return { error }
  try {
    const row = await prisma.component.create({
      data: {
        sku: input.sku?.trim() || null,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        unit: input.unit,
        stock: input.stock ?? 0,
        lowStockThreshold:
          input.lowStockThreshold === undefined || input.lowStockThreshold === null
            ? null
            : input.lowStockThreshold,
        supplier: input.supplier?.trim() || null,
        supplierUrl: input.supplierUrl?.trim() || null,
        costPerUnit:
          input.costPerUnit === undefined || input.costPerUnit === null ? null : input.costPerUnit,
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true,
      },
    })
    return { component: serializeComponent(row) }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return { error: 'Já existe componente com esse SKU.' }
    }
    captureException(err, { context: 'components-stock', detail: 'createComponent failed' })
    return { error: 'Erro ao criar componente.' }
  }
}

export async function updateComponent(
  id: string,
  input: Partial<ComponentInput>,
): Promise<{ component?: SerializedComponent; error?: string }> {
  if (!hasDatabase || !prisma?.component) return { error: 'Banco indisponível.' }
  if (input.unit !== undefined && !isValidUnit(input.unit)) {
    return { error: 'Unidade inválida.' }
  }
  if (input.name !== undefined && !input.name.trim()) {
    return { error: 'Nome é obrigatório.' }
  }
  try {
    const data: Prisma.ComponentUpdateInput = {}
    if (input.sku !== undefined) data.sku = input.sku?.trim() || null
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.description !== undefined) data.description = input.description?.trim() || null
    if (input.unit !== undefined) data.unit = input.unit
    if (input.lowStockThreshold !== undefined) {
      data.lowStockThreshold =
        input.lowStockThreshold === null ? null : input.lowStockThreshold
    }
    if (input.supplier !== undefined) data.supplier = input.supplier?.trim() || null
    if (input.supplierUrl !== undefined) data.supplierUrl = input.supplierUrl?.trim() || null
    if (input.costPerUnit !== undefined) {
      data.costPerUnit = input.costPerUnit === null ? null : input.costPerUnit
    }
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null
    if (input.isActive !== undefined) data.isActive = input.isActive

    // CRÍTICO: stock NÃO é alterado por updateComponent — usar lançarMovimento.
    // Evita admin "ajustar pra 100" sem deixar rastro no histórico.

    const row = await prisma.component.update({ where: { id }, data })
    return { component: serializeComponent(row) }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return { error: 'Já existe componente com esse SKU.' }
    }
    if ((err as { code?: string }).code === 'P2025') {
      return { error: 'Componente não encontrado.' }
    }
    captureException(err, { context: 'components-stock', detail: 'updateComponent failed' })
    return { error: 'Erro ao atualizar componente.' }
  }
}

export async function deleteComponent(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.component) return { ok: false, error: 'Banco indisponível.' }
  try {
    await prisma.component.delete({ where: { id } })
    return { ok: true }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return { ok: false, error: 'Componente não encontrado.' }
    }
    if ((err as { code?: string }).code === 'P2003') {
      return { ok: false, error: 'Componente está em uso por algum produto. Remova o vínculo antes.' }
    }
    captureException(err, { context: 'components-stock', detail: 'deleteComponent failed' })
    return { ok: false, error: 'Erro ao excluir componente.' }
  }
}

export interface RecordMovementInput {
  componentId: string
  type: StockMovementType
  quantity: number
  reason?: string | null
  relatedTaskId?: string | null
  relatedOrderNumber?: string | null
  createdByEmail?: string | null
}

/**
 * Cria um StockMovement e atualiza Component.stock atomicamente.
 *
 * - 'in' / 'reverse': soma ao estoque
 * - 'out' / 'adjust' (ajuste pra menos): subtrai
 * - quantity é SEMPRE positivo no input — o sinal vem do `type`
 *
 * Idempotência por relatedTaskId fica a cargo de quem chama (Fase 3 vai
 * usar isso pra evitar debitar duas vezes do mesmo ProductionLog).
 */
export async function recordMovement(
  input: RecordMovementInput,
): Promise<{ movement?: SerializedStockMovement; component?: SerializedComponent; error?: string }> {
  if (!hasDatabase || !prisma?.component || !prisma?.stockMovement) {
    return { error: 'Banco indisponível.' }
  }
  if (!MOVEMENT_TYPES.includes(input.type)) return { error: 'Tipo de movimento inválido.' }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { error: 'Quantidade deve ser positiva.' }
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.component.findUnique({ where: { id: input.componentId } })
      if (!current) throw new Error('NOT_FOUND')

      const currentStock = toNum(current.stock)
      const delta = input.type === 'in' || input.type === 'reverse' ? input.quantity : -input.quantity
      const balanceAfter = currentStock + delta
      // Stakeholder permite estoque negativo? Por enquanto NÃO — bloqueia
      // saída além do disponível. Saídas vindas de produção (Fase 3) podem
      // mudar essa regra se gerar fricção operacional.
      if (balanceAfter < 0) {
        throw new Error('NEGATIVE_BALANCE')
      }

      const updated = await tx.component.update({
        where: { id: input.componentId },
        data: { stock: balanceAfter },
      })

      const movement = await tx.stockMovement.create({
        data: {
          componentId: input.componentId,
          type: input.type,
          quantity: input.quantity,
          balanceAfter,
          reason: input.reason?.trim() || null,
          relatedTaskId: input.relatedTaskId || null,
          relatedOrderNumber: input.relatedOrderNumber || null,
          createdByEmail: input.createdByEmail || null,
        },
      })

      return { component: updated, movement }
    })

    log.info(
      { componentId: input.componentId, type: input.type, quantity: input.quantity },
      'stock movement recorded',
    )

    return {
      movement: serializeMovement(result.movement),
      component: serializeComponent(result.component),
    }
  } catch (err) {
    const message = (err as Error).message
    if (message === 'NOT_FOUND') return { error: 'Componente não encontrado.' }
    if (message === 'NEGATIVE_BALANCE') return { error: 'Estoque ficaria negativo. Ajuste a quantidade.' }
    captureException(err, { context: 'components-stock', detail: 'recordMovement failed' })
    return { error: 'Erro ao lançar movimento.' }
  }
}

export async function listMovements(
  componentId: string,
  options: { take?: number; skip?: number } = {},
): Promise<SerializedStockMovement[]> {
  if (!hasDatabase || !prisma?.stockMovement) return []
  const rows = await prisma.stockMovement.findMany({
    where: { componentId },
    orderBy: { createdAt: 'desc' },
    take: options.take ?? 100,
    skip: options.skip,
  })
  return rows.map(serializeMovement)
}

// ---------------------------------------------------------------------------
// AlertSettings
// ---------------------------------------------------------------------------

export interface AlertSettingsDto {
  lowStockEmails: string[]
  orderAlertEmails: string[]
  updatedAt: string | null
}

const DEFAULT_SETTINGS: AlertSettingsDto = {
  lowStockEmails: [],
  orderAlertEmails: [],
  updatedAt: null,
}

function parseEmailList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(v => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
    .filter(v => v.length > 0)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmails(input: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'Esperado array de e-mails.' }
  const cleaned: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') return { ok: false, error: 'E-mail inválido.' }
    const value = raw.trim().toLowerCase()
    if (!value) continue
    if (!EMAIL_RE.test(value)) return { ok: false, error: `E-mail inválido: ${value}` }
    if (!cleaned.includes(value)) cleaned.push(value)
  }
  return { ok: true, value: cleaned }
}

export async function getAlertSettings(): Promise<AlertSettingsDto> {
  if (!hasDatabase || !prisma?.alertSettings) return DEFAULT_SETTINGS
  const row = await prisma.alertSettings.findUnique({ where: { id: 'default' } })
  if (!row) return DEFAULT_SETTINGS
  return {
    lowStockEmails: parseEmailList(row.lowStockEmails),
    orderAlertEmails: parseEmailList(row.orderAlertEmails),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function updateAlertSettings(input: {
  lowStockEmails?: unknown
  orderAlertEmails?: unknown
}): Promise<{ settings?: AlertSettingsDto; error?: string }> {
  if (!hasDatabase || !prisma?.alertSettings) return { error: 'Banco indisponível.' }
  const update: { lowStockEmails?: string[]; orderAlertEmails?: string[] } = {}

  if (input.lowStockEmails !== undefined) {
    const result = validateEmails(input.lowStockEmails)
    if (!result.ok) return { error: result.error }
    update.lowStockEmails = result.value
  }
  if (input.orderAlertEmails !== undefined) {
    const result = validateEmails(input.orderAlertEmails)
    if (!result.ok) return { error: result.error }
    update.orderAlertEmails = result.value
  }

  try {
    const row = await prisma.alertSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        lowStockEmails: update.lowStockEmails ?? [],
        orderAlertEmails: update.orderAlertEmails ?? [],
      },
      update,
    })
    return {
      settings: {
        lowStockEmails: parseEmailList(row.lowStockEmails),
        orderAlertEmails: parseEmailList(row.orderAlertEmails),
        updatedAt: row.updatedAt.toISOString(),
      },
    }
  } catch (err) {
    captureException(err, { context: 'components-stock', detail: 'updateAlertSettings failed' })
    return { error: 'Erro ao salvar configurações.' }
  }
}

/**
 * Resolve a lista de e-mails que recebem alerta de baixa.
 * Fallback: RESEND_REPLY_TO_EMAIL se a tabela está vazia (não fica em silêncio).
 */
export async function getLowStockRecipients(): Promise<string[]> {
  const settings = await getAlertSettings()
  if (settings.lowStockEmails.length > 0) return settings.lowStockEmails
  const fallback = process.env.RESEND_REPLY_TO_EMAIL
  return fallback ? [fallback] : []
}

export async function getOrderAlertRecipients(): Promise<string[]> {
  const settings = await getAlertSettings()
  if (settings.orderAlertEmails.length > 0) return settings.orderAlertEmails
  const fallback = process.env.RESEND_REPLY_TO_EMAIL
  return fallback ? [fallback] : []
}

// ---------------------------------------------------------------------------
// Consumo automático de produção (Fase 3)
// ---------------------------------------------------------------------------

export interface ProductionConsumptionResult {
  /** Saídas (delta > 0) ou reversões (delta < 0) registradas. */
  movements: Array<{
    componentId: string
    componentName: string
    quantity: number
    balanceAfter: number
    reverted: boolean
  }>
  /** Componentes que ficaram em baixa após o consumo (snapshot pra alertar). */
  triggeredLowStock: Array<{ componentId: string; componentName: string; balanceAfter: number; threshold: number | null }>
  /** Componentes que ficaram negativos — sinal de baseline incorreta no estoque. */
  wentNegative: string[]
}

/**
 * Aplica consumo de componentes para uma `ProductionTask` num `ProductionLog`
 * recém-criado. Recebe a `tx` da transação aberta em `updateProductionTask`
 * — todas as escritas vivem na mesma transação atômica do log de produção.
 *
 * - delta > 0 → cria StockMovements `type: 'out'` (consumo)
 * - delta < 0 → cria StockMovements `type: 'reverse'` (correção; soma de volta)
 * - delta = 0 → no-op (admin alterou status sem produzir nada)
 *
 * Permite estoque negativo (operação real já consumiu o material; bloquear
 * aqui geraria fricção). O componente é criado mesmo, e quem precisa
 * monitorar age via alerta separado.
 *
 * Sem BOM declarada para o produto: no-op silencioso. Banner amarelo na UI
 * já avisa o admin.
 */
export async function applyProductionConsumption(
  tx: Prisma.TransactionClient,
  args: {
    taskId: string
    delta: number
    actorEmail?: string | null
  },
): Promise<ProductionConsumptionResult> {
  const empty: ProductionConsumptionResult = {
    movements: [],
    triggeredLowStock: [],
    wentNegative: [],
  }
  if (!Number.isFinite(args.delta) || args.delta === 0) return empty

  const task = await tx.productionTask.findUnique({
    where: { id: args.taskId },
    include: {
      order: { select: { orderNumber: true } },
      orderItem: { select: { productId: true, variantId: true } },
    },
  })
  if (!task || !task.orderItem) return empty

  // BOM: vínculos globais OR específicos da variante deste OrderItem.
  const bomRows = await tx.productComponent.findMany({
    where: {
      productId: task.orderItem.productId,
      OR: [{ variantId: null }, ...(task.orderItem.variantId ? [{ variantId: task.orderItem.variantId }] : [])],
    },
    include: { component: true },
  })
  if (bomRows.length === 0) return empty

  const isReversal = args.delta < 0
  const absUnits = Math.abs(args.delta)
  const result: ProductionConsumptionResult = {
    movements: [],
    triggeredLowStock: [],
    wentNegative: [],
  }

  for (const row of bomRows) {
    const qpu = toNum(row.quantityPerUnit)
    if (qpu <= 0) continue
    const consumption = qpu * absUnits
    const currentStock = toNum(row.component.stock)
    const balanceAfter = isReversal ? currentStock + consumption : currentStock - consumption

    await tx.component.update({
      where: { id: row.componentId },
      data: { stock: balanceAfter },
    })

    await tx.stockMovement.create({
      data: {
        componentId: row.componentId,
        type: isReversal ? 'reverse' : 'out',
        quantity: consumption,
        balanceAfter,
        reason: isReversal
          ? `Reversão de produção (-${absUnits} un)`
          : `Produção: ${absUnits} un consumidas`,
        relatedTaskId: args.taskId,
        relatedOrderNumber: task.order?.orderNumber ?? null,
        createdByEmail: args.actorEmail ?? null,
      },
    })

    result.movements.push({
      componentId: row.componentId,
      componentName: row.component.name,
      quantity: consumption,
      balanceAfter,
      reverted: isReversal,
    })

    const threshold = toNumOrNull(row.component.lowStockThreshold)
    if (!isReversal && threshold !== null && balanceAfter <= threshold) {
      result.triggeredLowStock.push({
        componentId: row.componentId,
        componentName: row.component.name,
        balanceAfter,
        threshold,
      })
    }
    if (balanceAfter < 0) result.wentNegative.push(row.component.name)
  }

  return result
}
