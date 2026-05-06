export type FulfillmentStatus =
  | 'pending'
  | 'aguardando_producao'
  | 'em_revisao'
  | 'arte_em_montagem'
  | 'liberado_producao'
  | 'in_production'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'cancelled'
  | 'refunded'

export type FulfillmentStatusInfo = {
  value: FulfillmentStatus
  label: string
  color: string
  pipelineOrder: number | null
  timelineKey: string | null
}

export type PaymentStatusInfo = {
  value: PaymentStatus
  label: string
  color: string
}

export const FULFILLMENT_PIPELINE: FulfillmentStatus[] = [
  'pending',
  'aguardando_producao',
  'em_revisao',
  'arte_em_montagem',
  'liberado_producao',
  'in_production',
  'ready_to_ship',
  'shipped',
  'delivered',
]

export const FULFILLMENT_STATUSES: FulfillmentStatusInfo[] = [
  { value: 'pending',             label: 'Pendente',             color: '#F59E0B', pipelineOrder: 0, timelineKey: null },
  { value: 'aguardando_producao', label: 'Aguardando produção',  color: '#94A3B8', pipelineOrder: 1, timelineKey: 'aguardando_producao_at' },
  { value: 'em_revisao',          label: 'Em revisão',           color: '#A78BFA', pipelineOrder: 2, timelineKey: 'em_revisao_at' },
  { value: 'arte_em_montagem',    label: 'Arte em montagem',     color: '#F472B6', pipelineOrder: 3, timelineKey: 'arte_montagem_at' },
  { value: 'liberado_producao',   label: 'Liberado para produção', color: '#38BDF8', pipelineOrder: 4, timelineKey: 'liberado_producao_at' },
  { value: 'in_production',       label: 'Em produção',          color: '#3B82F6', pipelineOrder: 5, timelineKey: 'in_production_at' },
  { value: 'ready_to_ship',       label: 'Pronto para envio',    color: '#1D7A72', pipelineOrder: 6, timelineKey: 'ready_to_ship_at' },
  { value: 'shipped',             label: 'Enviado',              color: '#8B5CF6', pipelineOrder: 7, timelineKey: 'shipped_at' },
  { value: 'delivered',           label: 'Entregue',             color: '#10B981', pipelineOrder: 8, timelineKey: 'delivered_at' },
  { value: 'cancelled',           label: 'Cancelado',            color: '#EF4444', pipelineOrder: null, timelineKey: null },
]

export const PAYMENT_STATUSES: PaymentStatusInfo[] = [
  { value: 'pending',   label: 'Pendente',  color: '#F59E0B' },
  { value: 'paid',      label: 'Pago',      color: '#10B981' },
  { value: 'rejected',  label: 'Recusado',  color: '#EF4444' },
  { value: 'failed',    label: 'Falhou',    color: '#EF4444' },
  { value: 'cancelled', label: 'Cancelado', color: '#6B7494' },
  { value: 'refunded',  label: 'Estornado', color: '#8B5CF6' },
]

export const TERMINAL_FULFILLMENT_STATUSES: FulfillmentStatus[] = ['delivered', 'cancelled']

export const FULFILLMENT_STATUSES_NOTIFYING_CUSTOMER: FulfillmentStatus[] = [
  'in_production',
  'shipped',
  'delivered',
]

export function getFulfillmentInfo(status: string | null | undefined): FulfillmentStatusInfo | null {
  if (!status) return null
  return FULFILLMENT_STATUSES.find(s => s.value === status) || null
}

export function getPaymentInfo(status: string | null | undefined): PaymentStatusInfo | null {
  if (!status) return null
  return PAYMENT_STATUSES.find(s => s.value === status) || null
}

export function getFulfillmentLabel(status: string | null | undefined): string {
  return getFulfillmentInfo(status)?.label || status || '—'
}

export function getPaymentLabel(status: string | null | undefined): string {
  return getPaymentInfo(status)?.label || status || '—'
}

export function isPipelineStatus(status: string | null | undefined): status is FulfillmentStatus {
  const info = getFulfillmentInfo(status)
  return Boolean(info && info.pipelineOrder !== null)
}

export function isTerminalStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return TERMINAL_FULFILLMENT_STATUSES.includes(status as FulfillmentStatus)
}

export function getNextStage(current: string | null | undefined): FulfillmentStatus | null {
  if (!current) return null
  if (current === 'cancelled') return null
  const idx = FULFILLMENT_PIPELINE.indexOf(current as FulfillmentStatus)
  if (idx === -1) return null
  if (idx >= FULFILLMENT_PIPELINE.length - 1) return null
  return FULFILLMENT_PIPELINE[idx + 1]
}

export function getPreviousStage(current: string | null | undefined): FulfillmentStatus | null {
  if (!current) return null
  if (current === 'cancelled') return null
  if (current === 'pending') return null
  const idx = FULFILLMENT_PIPELINE.indexOf(current as FulfillmentStatus)
  if (idx <= 0) return null
  return FULFILLMENT_PIPELINE[idx - 1]
}

export function canAdvance(current: string | null | undefined): boolean {
  return getNextStage(current) !== null
}

export function canRegress(current: string | null | undefined): boolean {
  return getPreviousStage(current) !== null
}

export type ProductionTimeline = {
  aguardando_producao_at?: string | null
  em_revisao_at?: string | null
  arte_montagem_at?: string | null
  liberado_producao_at?: string | null
  in_production_at?: string | null
  ready_to_ship_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
}

export function getTimelineKeyForStatus(status: string | null | undefined): keyof ProductionTimeline | null {
  const info = getFulfillmentInfo(status)
  return (info?.timelineKey as keyof ProductionTimeline | null) || null
}

export function withTimelineStamp(
  current: ProductionTimeline | null | undefined,
  status: FulfillmentStatus,
  at: Date = new Date(),
): ProductionTimeline {
  const next: ProductionTimeline = { ...(current || {}) }
  const key = getTimelineKeyForStatus(status)
  if (key) {
    next[key] = at.toISOString()
  }
  return next
}

export function listTimelineEntries(
  timeline: ProductionTimeline | null | undefined,
): Array<{ key: keyof ProductionTimeline; status: FulfillmentStatus; label: string; at: string }> {
  if (!timeline) return []
  const entries: Array<{ key: keyof ProductionTimeline; status: FulfillmentStatus; label: string; at: string }> = []
  for (const info of FULFILLMENT_STATUSES) {
    if (!info.timelineKey) continue
    const key = info.timelineKey as keyof ProductionTimeline
    const at = timeline[key]
    if (at) {
      entries.push({ key, status: info.value, label: info.label, at })
    }
  }
  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return entries
}
