// Pipeline redesign (Fase 1):
// - Dois pipelines selecionados por tipo de pedido (`sob_encomenda` /
//   `pronta_entrega`).
// - getNextStage/getPreviousStage agora exigem o tipo do pedido.
//   Sem `type` o pipeline retorna como se fosse 'sob_encomenda' (mais
//   permissivo) — fallback para call-sites antigas.
// - Branches finais (envio vs retirada) controlados por Order.deliveryMethod.

export type FulfillmentStatus =
  | 'pending'
  | 'confirmado'
  | 'aguardando_pagamento'
  | 'na_fila'
  | 'arte_em_montagem'
  | 'liberado_producao'
  | 'in_production'
  | 'ready_to_ship'
  | 'ready_to_pickup'
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

export type OrderType = 'sob_encomenda' | 'pronta_entrega'

export type DeliveryMethod = 'shipping' | 'pickup'

export type FulfillmentStatusInfo = {
  value: FulfillmentStatus
  label: string
  color: string
  // pipelineOrder is informational. Use the per-pipeline arrays below for
  // navigation (getNextStage / getPreviousStage), not this number.
  pipelineOrder: number | null
  timelineKey: string | null
}

export type PaymentStatusInfo = {
  value: PaymentStatus
  label: string
  color: string
}

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

// Pipeline 1: produtos sob encomenda ou personalizados.
// pending -> confirmado -> aguardando_pagamento -> na_fila ->
//   arte_em_montagem -> liberado_producao -> in_production ->
//   {ready_to_ship -> shipped} | ready_to_pickup -> delivered
//
// O ramo final (shipped vs ready_to_pickup) eh decidido pelo Order.deliveryMethod
// no momento de avancar a partir de in_production. listing abaixo eh do
// fluxo "shipping" (mais comum); o helper getNextStage trata o ramo de
// pickup explicitamente.
export const PIPELINE_SOB_ENCOMENDA: FulfillmentStatus[] = [
  'pending',
  'confirmado',
  'aguardando_pagamento',
  'na_fila',
  'arte_em_montagem',
  'liberado_producao',
  'in_production',
  'ready_to_ship',
  'shipped',
  'delivered',
]

// Pipeline 2: produtos a pronta entrega (sem necessidade de producao).
// pending -> confirmado -> aguardando_pagamento ->
//   {ready_to_ship -> shipped} | ready_to_pickup -> delivered
export const PIPELINE_PRONTA_ENTREGA: FulfillmentStatus[] = [
  'pending',
  'confirmado',
  'aguardando_pagamento',
  'ready_to_ship',
  'shipped',
  'delivered',
]

function getPipeline(type: OrderType | null | undefined): FulfillmentStatus[] {
  return type === 'pronta_entrega' ? PIPELINE_PRONTA_ENTREGA : PIPELINE_SOB_ENCOMENDA
}

/**
 * Retorna a sequencia EFETIVA de fases pelas quais o pedido vai passar,
 * considerando tipo + deliveryMethod. Diferente de PIPELINE_*, esta funcao
 * ja resolve o branch de envio vs retirada:
 *
 * - shipping: usa ready_to_ship -> shipped -> delivered (default).
 * - pickup:   substitui ready_to_ship por ready_to_pickup e remove shipped
 *             (cliente busca, vai direto pra delivered).
 *
 * Use esta funcao para renderizar timelines / visualizacoes do progresso
 * do pedido. Para navegacao (Avancar/Voltar) continue usando getNextStage/
 * getPreviousStage que ja conhecem os branches especiais.
 */
export function getEffectivePipeline(
  type: OrderType,
  deliveryMethod: DeliveryMethod = 'shipping',
): FulfillmentStatus[] {
  const base = getPipeline(type)
  if (deliveryMethod === 'pickup') {
    return base
      .map(s => (s === 'ready_to_ship' ? ('ready_to_pickup' as FulfillmentStatus) : s))
      .filter(s => s !== 'shipped')
  }
  return base
}

// Mantido para compat com callers antigos que iteram fases. Default = pipeline
// sob encomenda (mais completo).
export const FULFILLMENT_PIPELINE: FulfillmentStatus[] = PIPELINE_SOB_ENCOMENDA

export const FULFILLMENT_STATUSES: FulfillmentStatusInfo[] = [
  { value: 'pending',              label: 'Pendente',                color: '#F59E0B', pipelineOrder: 0,  timelineKey: null },
  { value: 'confirmado',           label: 'Confirmado',              color: '#22D3EE', pipelineOrder: 1,  timelineKey: 'confirmado_at' },
  { value: 'aguardando_pagamento', label: 'Aguardando pagamento',    color: '#FB923C', pipelineOrder: 2,  timelineKey: 'aguardando_pagamento_at' },
  { value: 'na_fila',              label: 'Na fila',                 color: '#94A3B8', pipelineOrder: 3,  timelineKey: 'na_fila_at' },
  { value: 'arte_em_montagem',     label: 'Arte em montagem',        color: '#F472B6', pipelineOrder: 4,  timelineKey: 'arte_montagem_at' },
  { value: 'liberado_producao',    label: 'Liberado para produção',  color: '#38BDF8', pipelineOrder: 5,  timelineKey: 'liberado_producao_at' },
  { value: 'in_production',        label: 'Em produção',             color: '#3B82F6', pipelineOrder: 6,  timelineKey: 'in_production_at' },
  { value: 'ready_to_ship',        label: 'Pronto para envio',       color: '#1D7A72', pipelineOrder: 7,  timelineKey: 'ready_to_ship_at' },
  { value: 'ready_to_pickup',      label: 'Pronto para retirada',    color: '#0E9F6E', pipelineOrder: 7,  timelineKey: 'ready_to_pickup_at' },
  { value: 'shipped',              label: 'Enviado',                 color: '#8B5CF6', pipelineOrder: 8,  timelineKey: 'shipped_at' },
  { value: 'delivered',            label: 'Entregue',                color: '#10B981', pipelineOrder: 9,  timelineKey: 'delivered_at' },
  { value: 'cancelled',            label: 'Cancelado',               color: '#EF4444', pipelineOrder: null, timelineKey: null },
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

// Quais transicoes notificam o cliente (template de e-mail dispara).
// Os 3 novos sao templates novos da Fase 4 (confirmado, aguardando_pagamento,
// ready_to_pickup).
export const FULFILLMENT_STATUSES_NOTIFYING_CUSTOMER: FulfillmentStatus[] = [
  'confirmado',
  'aguardando_pagamento',
  'in_production',
  'ready_to_pickup',
  'shipped',
  'delivered',
]

// Fases produtivas: usadas pela bridge para criar ProductionTask.
export const PRODUCTION_PHASES: FulfillmentStatus[] = ['liberado_producao', 'in_production']

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

export function isProductionPhase(status: string | null | undefined): boolean {
  if (!status) return false
  return PRODUCTION_PHASES.includes(status as FulfillmentStatus)
}

// ---------------------------------------------------------------------------
// Order type derivation
// ---------------------------------------------------------------------------

// Item shape minimo que sabemos derivar tipo. Aceita tanto OrderItem hidratado
// (com product) quanto a versao serializada que so tem flags coladas.
export interface OrderItemForType {
  product?: {
    underOrder?: boolean | null
    isPersonalizable?: boolean | null
  } | null
  underOrder?: boolean | null
  isPersonalizable?: boolean | null
}

/**
 * Determina o pipeline aplicavel ao pedido.
 *
 * Regra: se ALGUM item do pedido for sob encomenda ou personalizavel, o
 * pedido inteiro segue o pipeline `sob_encomenda` (mais lento, com etapas
 * de producao). Caso contrario, segue `pronta_entrega`.
 *
 * Pedidos vazios ou sem informacao defaultam para `sob_encomenda` por seguranca
 * — eh o pipeline mais completo, evita "pular" fases caso a derivacao falhe.
 */
export function getOrderType(items: OrderItemForType[] | null | undefined): OrderType {
  if (!items || items.length === 0) return 'sob_encomenda'
  for (const item of items) {
    const underOrder = Boolean(item.product?.underOrder ?? item.underOrder)
    const personalizable = Boolean(item.product?.isPersonalizable ?? item.isPersonalizable)
    if (underOrder || personalizable) return 'sob_encomenda'
  }
  return 'pronta_entrega'
}

// ---------------------------------------------------------------------------
// Stage navigation
// ---------------------------------------------------------------------------

interface StageNavOptions {
  type?: OrderType | null
  deliveryMethod?: DeliveryMethod | null
  // paymentStatus permite que `confirmado` pule `aguardando_pagamento` quando
  // o pedido ja foi pago. Sem ele, `confirmado` sempre cai em
  // `aguardando_pagamento` (default conservador: admin tem que avancar mais
  // uma vez se o pagamento ja chegou).
  paymentStatus?: PaymentStatus | string | null
}

/**
 * Proximo estagio segundo o pipeline aplicavel.
 *
 * Casos especiais:
 * - confirmado: pula `aguardando_pagamento` se paymentStatus='paid'.
 * - in_production (pipeline sob_encomenda) -> ready_to_pickup se delivery=pickup,
 *                                              senao ready_to_ship.
 * - aguardando_pagamento (pipeline pronta_entrega) -> ready_to_pickup se
 *                                              delivery=pickup, senao ready_to_ship.
 * - ready_to_pickup -> delivered (pula 'shipped').
 */
export function getNextStage(
  current: string | null | undefined,
  options?: StageNavOptions,
): FulfillmentStatus | null {
  if (!current) return null
  if (current === 'cancelled') return null
  if (current === 'delivered') return null

  const type = options?.type ?? 'sob_encomenda'
  const delivery = options?.deliveryMethod ?? 'shipping'
  const paymentPaid = options?.paymentStatus === 'paid'

  // Branches especiais antes do pipeline linear.
  if (current === 'ready_to_pickup') return 'delivered'

  // confirmado: se ja pago, pula aguardando_pagamento e vai direto pra fila/envio.
  if (current === 'confirmado' && paymentPaid) {
    if (type === 'pronta_entrega') {
      return delivery === 'pickup' ? 'ready_to_pickup' : 'ready_to_ship'
    }
    return 'na_fila'
  }

  // Pipeline sob_encomenda: depois de in_production decide envio vs retirada.
  if (type === 'sob_encomenda' && current === 'in_production') {
    return delivery === 'pickup' ? 'ready_to_pickup' : 'ready_to_ship'
  }

  // Pipeline pronta_entrega: depois de aguardando_pagamento decide envio vs retirada.
  if (type === 'pronta_entrega' && current === 'aguardando_pagamento') {
    return delivery === 'pickup' ? 'ready_to_pickup' : 'ready_to_ship'
  }

  const pipeline = getPipeline(type)
  const idx = pipeline.indexOf(current as FulfillmentStatus)
  if (idx === -1) return null
  if (idx >= pipeline.length - 1) return null
  return pipeline[idx + 1]
}

/**
 * Estagio anterior segundo o pipeline aplicavel.
 *
 * Casos especiais (espelham getNextStage):
 * - ready_to_pickup volta para in_production (sob_encomenda) ou
 *                   aguardando_pagamento (pronta_entrega).
 * - delivered volta para shipped (envio) ou ready_to_pickup (retirada).
 */
export function getPreviousStage(
  current: string | null | undefined,
  options?: StageNavOptions,
): FulfillmentStatus | null {
  if (!current) return null
  if (current === 'cancelled') return null
  if (current === 'pending') return null

  const type = options?.type ?? 'sob_encomenda'
  const delivery = options?.deliveryMethod ?? 'shipping'

  // Branches especiais.
  if (current === 'ready_to_pickup') {
    return type === 'pronta_entrega' ? 'aguardando_pagamento' : 'in_production'
  }
  if (current === 'delivered') {
    return delivery === 'pickup' ? 'ready_to_pickup' : 'shipped'
  }

  const pipeline = getPipeline(type)
  const idx = pipeline.indexOf(current as FulfillmentStatus)
  if (idx <= 0) return null
  return pipeline[idx - 1]
}

export function canAdvance(
  current: string | null | undefined,
  options?: StageNavOptions,
): boolean {
  return getNextStage(current, options) !== null
}

export function canRegress(
  current: string | null | undefined,
  options?: StageNavOptions,
): boolean {
  return getPreviousStage(current, options) !== null
}

/**
 * Auto-transicao quando o pagamento eh confirmado: se o pedido estava em
 * `aguardando_pagamento`, avanca para a proxima fase do pipeline (sob encomenda
 * vai para `na_fila`, pronta entrega vai para `ready_to_ship` ou
 * `ready_to_pickup` conforme delivery).
 *
 * Em qualquer outra fase (pending, confirmado, na_fila, in_production etc),
 * a confirmacao de pagamento NAO mexe no fulfillment — admin avanca
 * manualmente. Essa eh a checagem de seguranca que o stakeholder pediu
 * (pedido site com pagamento aprovado nao pula a validacao do admin).
 *
 * Retorna o novo fulfillmentStatus ou null (nao auto-transitar).
 */
export function autoTransitionOnPayment(
  currentFulfillmentStatus: string | null | undefined,
  options: { type: OrderType; deliveryMethod: DeliveryMethod },
): FulfillmentStatus | null {
  if (currentFulfillmentStatus !== 'aguardando_pagamento') return null

  if (options.type === 'pronta_entrega') {
    return options.deliveryMethod === 'pickup' ? 'ready_to_pickup' : 'ready_to_ship'
  }
  return 'na_fila'
}

// ---------------------------------------------------------------------------
// Production timeline
// ---------------------------------------------------------------------------

export type ProductionTimeline = {
  confirmado_at?: string | null
  aguardando_pagamento_at?: string | null
  na_fila_at?: string | null
  arte_montagem_at?: string | null
  liberado_producao_at?: string | null
  in_production_at?: string | null
  ready_to_ship_at?: string | null
  ready_to_pickup_at?: string | null
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
