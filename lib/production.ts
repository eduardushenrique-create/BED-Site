/**
 * BED Design - Production domain logic (pure functions, no Prisma dependency).
 *
 * This module hosts the calculations and serializers for the production
 * control feature (made-to-order / personalized items). All functions are
 * pure: they receive already-loaded data and return plain JSON-friendly
 * shapes. The `now` parameter is always injectable to make risk math
 * deterministic and testable.
 *
 * See: bed_design_claude_production_control_brief.md sections 5 and 7.
 */

// ---------------------------------------------------------------------------
// Domain enums
// ---------------------------------------------------------------------------

export type ProductionTaskStatus =
  | 'pending'
  | 'in_production'
  | 'paused'
  | 'completed'
  | 'cancelled'

export type ProductionPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent'

export type ProductionRiskLevel =
  | 'on_track'
  | 'attention'
  | 'at_risk'
  | 'overdue'
  | 'completed'

// ---------------------------------------------------------------------------
// Settings shape (mirrors ProductionSettings model)
// ---------------------------------------------------------------------------

export interface ProductionSettingsLike {
  dailyCapacityMinutes: number
  riskBufferHours: number
  businessDaysOnly: boolean
}

// ---------------------------------------------------------------------------
// Public output shapes
// ---------------------------------------------------------------------------

export interface ProductionProgress {
  remainingQuantity: number
  progressPercent: number
}

export interface ProductionRisk {
  level: ProductionRiskLevel
  label: string
  reason?: string
  expectedProgressPercent?: number
  estimatedRemainingMinutes?: number
  estimatedCompletionAt?: Date | null
}

// Threshold (in percentage points) used to flag a task as `attention`.
// Picked at 15pp: anything beyond that is "muito abaixo" of the linear
// expected curve, while still leaving room for normal slow starts.
const ATTENTION_PROGRESS_GAP_THRESHOLD = 15

// ---------------------------------------------------------------------------
// 5.4 - Progress
// ---------------------------------------------------------------------------

export interface CalculateProductionProgressInput {
  requiredQuantity: number
  producedQuantity: number
}

export function calculateProductionProgress(
  input: CalculateProductionProgressInput
): ProductionProgress {
  const required = Math.max(0, Math.floor(input.requiredQuantity ?? 0))
  const produced = Math.max(0, Math.floor(input.producedQuantity ?? 0))
  const remainingQuantity = Math.max(required - produced, 0)
  const progressPercent =
    required === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((produced / required) * 100)))

  return { remainingQuantity, progressPercent }
}

// ---------------------------------------------------------------------------
// Production unit minutes (variant > product > null)
// ---------------------------------------------------------------------------

export interface ProductionUnitMinutesInput {
  product?: { productionMinutesPerUnit?: number | null } | null
  variant?: { productionMinutesPerUnit?: number | null } | null
}

export function getProductionUnitMinutes(
  input: ProductionUnitMinutesInput
): number | null {
  const variantMinutes = input.variant?.productionMinutesPerUnit
  if (typeof variantMinutes === 'number' && variantMinutes > 0) {
    return variantMinutes
  }
  const productMinutes = input.product?.productionMinutesPerUnit
  if (typeof productMinutes === 'number' && productMinutes > 0) {
    return productMinutes
  }
  return null
}

// ---------------------------------------------------------------------------
// 5.5 - Risk
// ---------------------------------------------------------------------------

export interface CalculateProductionRiskInput {
  requiredQuantity: number
  producedQuantity: number
  createdAt: Date | string | null | undefined
  startedAt: Date | string | null | undefined
  dueAt: Date | string | null | undefined
  productionMinutesPerUnit?: number | null
  settings: ProductionSettingsLike
  now: Date
  status: ProductionTaskStatus
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? d : null
}

/**
 * Estimate when the remaining work will be completed, given a daily capacity
 * (minutes per day). Time before "now" within today counts toward today's
 * capacity (we treat now as the start of work, no calendar/business-day logic
 * in MVP — businessDaysOnly is honored only as a coarse multiplier hook).
 */
function estimateCompletionAt(
  now: Date,
  remainingMinutes: number,
  dailyCapacityMinutes: number
): Date {
  const cap = Math.max(1, dailyCapacityMinutes)
  if (remainingMinutes <= 0) return new Date(now.getTime())

  const fullDays = Math.floor(remainingMinutes / cap)
  const tailMinutes = remainingMinutes % cap
  const totalMinutes = fullDays * 24 * 60 + tailMinutes
  return new Date(now.getTime() + totalMinutes * 60 * 1000)
}

export function calculateProductionRisk(
  input: CalculateProductionRiskInput
): ProductionRisk {
  const required = Math.max(0, Math.floor(input.requiredQuantity ?? 0))
  const produced = Math.max(0, Math.floor(input.producedQuantity ?? 0))
  const { remainingQuantity, progressPercent } = calculateProductionProgress({
    requiredQuantity: required,
    producedQuantity: produced,
  })

  const now = input.now
  const dueAt = toDate(input.dueAt)
  const createdAt = toDate(input.createdAt)
  const startedAt = toDate(input.startedAt)

  // Rule 1: Completed
  if (input.status === 'completed' || (required > 0 && produced >= required)) {
    return {
      level: 'completed',
      label: getProductionRiskLabel('completed'),
    }
  }

  // Estimate (used by rules 3 and as informational output)
  const minutesPerUnit = input.productionMinutesPerUnit ?? null
  let estimatedRemainingMinutes: number | undefined
  let estimatedCompletionAt: Date | null | undefined
  if (minutesPerUnit && minutesPerUnit > 0 && remainingQuantity > 0) {
    estimatedRemainingMinutes = remainingQuantity * minutesPerUnit
    estimatedCompletionAt = estimateCompletionAt(
      now,
      estimatedRemainingMinutes,
      input.settings.dailyCapacityMinutes
    )
  } else if (remainingQuantity === 0) {
    estimatedRemainingMinutes = 0
    estimatedCompletionAt = now
  }

  // Rule 2: Overdue
  if (dueAt && remainingQuantity > 0 && now.getTime() > dueAt.getTime()) {
    return {
      level: 'overdue',
      label: getProductionRiskLabel('overdue'),
      reason: 'Prazo de entrega já passou e ainda há unidades a produzir.',
      estimatedRemainingMinutes,
      estimatedCompletionAt: estimatedCompletionAt ?? null,
    }
  }

  // Expected progress percent (for rules 3 attention reasons and rule 5)
  let expectedProgressPercent: number | undefined
  if (dueAt) {
    const startRef = startedAt ?? createdAt
    if (startRef && dueAt.getTime() > startRef.getTime()) {
      const totalSpan = dueAt.getTime() - startRef.getTime()
      const elapsed = Math.max(0, now.getTime() - startRef.getTime())
      const ratio = Math.max(0, Math.min(1, elapsed / totalSpan))
      expectedProgressPercent = Math.round(ratio * 100)
    }
  }

  // Rule 3: estimate beyond due date
  if (
    dueAt &&
    estimatedCompletionAt &&
    estimatedCompletionAt.getTime() > dueAt.getTime()
  ) {
    return {
      level: 'at_risk',
      label: getProductionRiskLabel('at_risk'),
      reason:
        'A estimativa de produção ultrapassa o prazo configurado para o pedido.',
      expectedProgressPercent,
      estimatedRemainingMinutes,
      estimatedCompletionAt,
    }
  }

  // Rule 4: due date inside risk buffer
  if (dueAt) {
    const bufferMs = Math.max(0, input.settings.riskBufferHours) * 60 * 60 * 1000
    const remainingMs = dueAt.getTime() - now.getTime()
    if (remainingMs >= 0 && remainingMs <= bufferMs && remainingQuantity > 0) {
      return {
        level: 'at_risk',
        label: getProductionRiskLabel('at_risk'),
        reason:
          'Prazo está dentro do buffer de risco e ainda há unidades pendentes.',
        expectedProgressPercent,
        estimatedRemainingMinutes,
        estimatedCompletionAt: estimatedCompletionAt ?? null,
      }
    }
  }

  // Rule 5: attention - progress lagging expected curve
  if (
    typeof expectedProgressPercent === 'number' &&
    expectedProgressPercent - progressPercent >= ATTENTION_PROGRESS_GAP_THRESHOLD
  ) {
    return {
      level: 'attention',
      label: getProductionRiskLabel('attention'),
      reason: `Progresso (${progressPercent}%) está abaixo do esperado (${expectedProgressPercent}%) para o tempo decorrido.`,
      expectedProgressPercent,
      estimatedRemainingMinutes,
      estimatedCompletionAt: estimatedCompletionAt ?? null,
    }
  }

  // Rule 6: on track
  return {
    level: 'on_track',
    label: getProductionRiskLabel('on_track'),
    expectedProgressPercent,
    estimatedRemainingMinutes,
    estimatedCompletionAt: estimatedCompletionAt ?? null,
  }
}

// ---------------------------------------------------------------------------
// Labels (PT-BR)
// ---------------------------------------------------------------------------

export function getProductionRiskLabel(level: ProductionRiskLevel): string {
  switch (level) {
    case 'on_track':
      return 'Dentro do prazo'
    case 'attention':
      return 'Atenção'
    case 'at_risk':
      return 'Em risco'
    case 'overdue':
      return 'Atrasado'
    case 'completed':
      return 'Concluído'
  }
}

export function getCustomerProductionLabel(status: ProductionTaskStatus): string {
  switch (status) {
    case 'pending':
      return 'Preparando produção'
    case 'in_production':
      return 'Em produção'
    case 'paused':
      // Pausa não é exposta como tal ao cliente.
      return 'Em produção'
    case 'completed':
      return 'Produção concluída'
    case 'cancelled':
      return 'Produção cancelada'
  }
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export interface ProductionTaskWithRelations {
  id: string
  status: string
  priority: string
  requiredQuantity: number
  producedQuantity: number
  dueAt: Date | string | null
  startedAt: Date | string | null
  completedAt: Date | string | null
  notes: string | null
  createdAt: Date | string
  updatedAt: Date | string
  order: {
    id: string
    orderNumber: string
    customerName: string | null
    customerEmail: string | null
    fulfillmentStatus: string | null
    productionDeadline: Date | string | null
  }
  orderItem: {
    id: string
    productNameSnapshot: string | null
    skuSnapshot: string | null
    quantity: number
    variantId: string | null
  }
  product?: { productionMinutesPerUnit?: number | null } | null
  variant?: { productionMinutesPerUnit?: number | null } | null
}

export interface SerializeProductionTaskOptions {
  settings: ProductionSettingsLike
  now: Date
}

export interface SerializedProductionTaskAdmin {
  id: string
  status: ProductionTaskStatus
  priority: ProductionPriority
  requiredQuantity: number
  producedQuantity: number
  remainingQuantity: number
  progressPercent: number
  dueAt: string | null
  startedAt: string | null
  completedAt: string | null
  notes: string | null
  risk: {
    level: ProductionRiskLevel
    label: string
    reason: string | null
    expectedProgressPercent: number | null
    estimatedRemainingMinutes: number | null
    estimatedCompletionAt: string | null
  }
  order: {
    id: string
    orderNumber: string
    customerName: string | null
    customerEmail: string | null
    fulfillmentStatus: string | null
    productionDeadline: string | null
  }
  item: {
    id: string
    productNameSnapshot: string | null
    skuSnapshot: string | null
    quantity: number
    variantId: string | null
  }
  updatedAt: string
}

function normalizeStatus(value: string | null | undefined): ProductionTaskStatus {
  switch (value) {
    case 'pending':
    case 'in_production':
    case 'paused':
    case 'completed':
    case 'cancelled':
      return value
    default:
      return 'pending'
  }
}

function normalizePriority(value: string | null | undefined): ProductionPriority {
  switch (value) {
    case 'low':
    case 'normal':
    case 'high':
    case 'urgent':
      return value
    default:
      return 'normal'
  }
}

function dateToIso(value: Date | string | null | undefined): string | null {
  const d = toDate(value)
  return d ? d.toISOString() : null
}

export function serializeProductionTask(
  task: ProductionTaskWithRelations,
  options: SerializeProductionTaskOptions
): SerializedProductionTaskAdmin {
  const status = normalizeStatus(task.status)
  const priority = normalizePriority(task.priority)
  const { remainingQuantity, progressPercent } = calculateProductionProgress({
    requiredQuantity: task.requiredQuantity,
    producedQuantity: task.producedQuantity,
  })

  const productionMinutesPerUnit = getProductionUnitMinutes({
    product: task.product ?? null,
    variant: task.variant ?? null,
  })

  const risk = calculateProductionRisk({
    requiredQuantity: task.requiredQuantity,
    producedQuantity: task.producedQuantity,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    dueAt: task.dueAt,
    productionMinutesPerUnit,
    settings: options.settings,
    now: options.now,
    status,
  })

  return {
    id: task.id,
    status,
    priority,
    requiredQuantity: task.requiredQuantity,
    producedQuantity: task.producedQuantity,
    remainingQuantity,
    progressPercent,
    dueAt: dateToIso(task.dueAt),
    startedAt: dateToIso(task.startedAt),
    completedAt: dateToIso(task.completedAt),
    notes: task.notes ?? null,
    risk: {
      level: risk.level,
      label: risk.label,
      reason: risk.reason ?? null,
      expectedProgressPercent:
        typeof risk.expectedProgressPercent === 'number'
          ? risk.expectedProgressPercent
          : null,
      estimatedRemainingMinutes:
        typeof risk.estimatedRemainingMinutes === 'number'
          ? risk.estimatedRemainingMinutes
          : null,
      estimatedCompletionAt: risk.estimatedCompletionAt
        ? risk.estimatedCompletionAt.toISOString()
        : null,
    },
    order: {
      id: task.order.id,
      orderNumber: task.order.orderNumber,
      customerName: task.order.customerName ?? null,
      customerEmail: task.order.customerEmail ?? null,
      fulfillmentStatus: task.order.fulfillmentStatus ?? null,
      productionDeadline: dateToIso(task.order.productionDeadline),
    },
    item: {
      id: task.orderItem.id,
      productNameSnapshot: task.orderItem.productNameSnapshot ?? null,
      skuSnapshot: task.orderItem.skuSnapshot ?? null,
      quantity: task.orderItem.quantity,
      variantId: task.orderItem.variantId ?? null,
    },
    updatedAt: dateToIso(task.updatedAt) ?? new Date(0).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Customer-facing serializer (no internal data)
// ---------------------------------------------------------------------------

export interface CustomerProductionTaskInput {
  status: string
  requiredQuantity: number
  producedQuantity: number
  updatedAt: Date | string
  orderItem: {
    productNameSnapshot: string | null
  }
}

export interface SerializedCustomerProductionItem {
  productName: string
  requiredQuantity: number
  producedQuantity: number
  remainingQuantity: number
  progressPercent: number
  status: ProductionTaskStatus
  label: string
  updatedAt: string
}

export interface SerializedCustomerProduction {
  orderNumber: string
  hasProduction: boolean
  overall: {
    requiredQuantity: number
    producedQuantity: number
    remainingQuantity: number
    progressPercent: number
    status: ProductionTaskStatus
    label: string
  } | null
  items: SerializedCustomerProductionItem[]
}

/**
 * Aggregate the per-task statuses into a single overall status for the
 * customer view. Priority order:
 *   cancelled (only if all cancelled) > completed (all completed) >
 *   in_production (any active) > pending (default).
 */
function aggregateOverallStatus(
  statuses: ProductionTaskStatus[]
): ProductionTaskStatus {
  if (statuses.length === 0) return 'pending'
  if (statuses.every((s) => s === 'cancelled')) return 'cancelled'

  const active = statuses.filter((s) => s !== 'cancelled')
  if (active.length === 0) return 'cancelled'

  if (active.every((s) => s === 'completed')) return 'completed'
  if (active.some((s) => s === 'in_production' || s === 'paused')) {
    return 'in_production'
  }
  return 'pending'
}

export function serializeCustomerProduction(
  tasks: CustomerProductionTaskInput[],
  orderNumber: string
): SerializedCustomerProduction {
  const hasProduction = tasks.length > 0

  const items: SerializedCustomerProductionItem[] = tasks.map((task) => {
    const rawStatus = normalizeStatus(task.status)
    // Privacidade: cliente nunca vê 'paused' literal — mascara como 'in_production'
    const status: ProductionTaskStatus = rawStatus === 'paused' ? 'in_production' : rawStatus
    const { remainingQuantity, progressPercent } = calculateProductionProgress({
      requiredQuantity: task.requiredQuantity,
      producedQuantity: task.producedQuantity,
    })
    return {
      productName: task.orderItem.productNameSnapshot ?? 'Item personalizado',
      requiredQuantity: task.requiredQuantity,
      producedQuantity: task.producedQuantity,
      remainingQuantity,
      progressPercent,
      status,
      label: getCustomerProductionLabel(status),
      updatedAt:
        dateToIso(task.updatedAt) ?? new Date(0).toISOString(),
    }
  })

  const totals = tasks.reduce(
    (acc, task) => {
      acc.requiredQuantity += Math.max(0, Math.floor(task.requiredQuantity ?? 0))
      acc.producedQuantity += Math.max(0, Math.floor(task.producedQuantity ?? 0))
      return acc
    },
    { requiredQuantity: 0, producedQuantity: 0 }
  )

  const overallProgress = calculateProductionProgress(totals)
  const overallStatus = aggregateOverallStatus(items.map((i) => i.status))

  return {
    orderNumber,
    hasProduction,
    overall: {
      requiredQuantity: totals.requiredQuantity,
      producedQuantity: totals.producedQuantity,
      remainingQuantity: overallProgress.remainingQuantity,
      progressPercent: overallProgress.progressPercent,
      status: overallStatus,
      label: getCustomerProductionLabel(overallStatus),
    },
    items,
  }
}
