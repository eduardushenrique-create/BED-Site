import 'server-only'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { hasDatabase, DatabaseUnavailableError } from '@/lib/database'

/**
 * SPEC-005 Fase 2a — gestao de PaymentInstallment.
 *
 * Toda mutacao passa por `prisma.$transaction` com lock pessimista
 * (`SELECT ... FOR UPDATE` no Order) para evitar race entre dois admins
 * registrando ao mesmo tempo (R3 do ADR-003 v2). Recalculo de
 * paidAmount/dueAmount sai SEMPRE de uma fonte unica (recalculatePaidAmount)
 * — banido escrever paidAmount diretamente fora deste arquivo (R11,
 * enforcement via ci/forbidden-patterns.sh em PR futuro).
 *
 * Nao trata `Payment` legado (1:1 com Order, fonte do webhook MP). Os
 * dois coexistem; webhook MP em PR futuro vira upsert idempotente em
 * PaymentInstallment com `paymentId` unico (R8).
 *
 * Em prod sem DB ou com DB caindo: lanca DatabaseUnavailableError (mesmo
 * padrao de createOrder/updateOrder pos-PR-4).
 */

const FAIL_FAST_IN_PRODUCTION =
  process.env.NODE_ENV === 'production' && Boolean(process.env.DATABASE_URL)

const installmentClient = (): any => (prisma as any)?.paymentInstallment

// 'cash' | 'pix_manual' | 'bank_transfer' | 'mercadopago' | 'other'
const VALID_METHODS = new Set(['cash', 'pix_manual', 'bank_transfer', 'mercadopago', 'other'])

export type InstallmentDto = {
  id: string
  orderId: string
  sequence: number
  amount: number
  method: string
  description: string | null
  receivedAt: string
  receivedByEmail: string
  notes: string | null
  isRefund: boolean
  paymentId: string | null
  createdAt: string
  updatedAt: string
}

export type InstallmentInput = {
  amount: number
  method: string
  description?: string | null
  receivedAt?: string | null
  notes?: string | null
  isRefund?: boolean
}

export type OrderTotals = {
  total: number
  paidAmount: number
  dueAmount: number
}

function toNumber(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0
  if (typeof d === 'number') return d
  return Number(d.toFixed(2))
}

function serializeInstallment(row: any): InstallmentDto {
  return {
    id: row.id,
    orderId: row.orderId,
    sequence: row.sequence,
    amount: toNumber(row.amount),
    method: row.method,
    description: row.description,
    receivedAt: row.receivedAt instanceof Date ? row.receivedAt.toISOString() : row.receivedAt,
    receivedByEmail: row.receivedByEmail,
    notes: row.notes,
    isRefund: row.isRefund,
    paymentId: row.paymentId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}

function ensureDb(): asserts prisma is NonNullable<typeof prisma> {
  if (!hasDatabase || !prisma?.order || !installmentClient()) {
    if (FAIL_FAST_IN_PRODUCTION) {
      throw new DatabaseUnavailableError(
        'Operacao de pagamento indisponivel no momento. Tente novamente em alguns instantes.',
      )
    }
    throw new DatabaseUnavailableError('DB indisponivel (modo dev/teste sem prisma).')
  }
}

function validateInput(input: InstallmentInput): { ok: true; data: Required<InstallmentInput> } | { ok: false; error: string } {
  // R17 do ADR-003 v2: amount deve estar em (0, 100000]. CHECK constraint
  // tambem valida no banco, mas falhar cedo eh melhor (mensagem clara).
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount)) {
    return { ok: false, error: 'amount deve ser um numero' }
  }
  if (input.amount <= 0) {
    return { ok: false, error: 'amount deve ser maior que zero' }
  }
  if (input.amount > 100000) {
    return { ok: false, error: 'amount excede o limite de R$ 100.000,00 por parcela' }
  }
  if (!input.method || typeof input.method !== 'string' || !VALID_METHODS.has(input.method)) {
    return {
      ok: false,
      error: `method deve ser um de: ${[...VALID_METHODS].join(', ')}`,
    }
  }
  return {
    ok: true,
    data: {
      amount: Math.round(input.amount * 100) / 100,
      method: input.method,
      description: typeof input.description === 'string' ? input.description.slice(0, 500) : null,
      receivedAt: typeof input.receivedAt === 'string' ? input.receivedAt : new Date().toISOString(),
      notes: typeof input.notes === 'string' ? input.notes.slice(0, 1000) : null,
      isRefund: Boolean(input.isRefund),
    },
  }
}

/**
 * Recalcula `Order.paidAmount`/`Order.dueAmount` a partir das installments
 * ativas. UNICA forma legitima de mexer nesses campos. Usa o tx fornecido
 * (espera-se que caller ja tenha lock pessimista no Order).
 *
 * Tambem auto-transiciona `paymentStatus`:
 *   - paidAmount >= total -> 'paid'
 *   - 0 < paidAmount < total -> 'partial' (novo, SPEC-005 §3.2.3)
 *   - paidAmount == 0 -> mantem o que estava (pode ser 'pending', 'rejected' etc.)
 */
export async function recalculatePaidAmount(
  orderId: string,
  tx: Prisma.TransactionClient,
): Promise<OrderTotals> {
  const installments = await (tx as any).paymentInstallment.findMany({
    where: { orderId, deletedAt: null },
    select: { amount: true, isRefund: true },
  })

  let paid = 0
  for (const i of installments) {
    const v = toNumber(i.amount)
    paid += i.isRefund ? -v : v
  }
  if (paid < 0) paid = 0

  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { total: true, paymentStatus: true },
  })
  const total = toNumber(order.total)
  const due = Math.max(0, Math.round((total - paid) * 100) / 100)

  // Auto-transicao paymentStatus
  let nextStatus = order.paymentStatus
  if (paid >= total && total > 0) {
    nextStatus = 'paid'
  } else if (paid > 0 && paid < total) {
    nextStatus = 'partial'
  }
  // Se paid == 0, NAO sobrescreve (pode estar 'pending', 'rejected' etc.)

  await tx.order.update({
    where: { id: orderId },
    data: {
      paidAmount: paid,
      dueAmount: due,
      paymentStatus: nextStatus,
    },
  })

  return { total, paidAmount: paid, dueAmount: due }
}

/**
 * Cria uma installment nova. Aloca a proxima `sequence` no contexto da
 * transacao com lock pessimista no Order. Recalcula paidAmount/dueAmount
 * antes de retornar.
 */
export async function createInstallment(
  orderId: string,
  input: InstallmentInput,
  by: { email: string; isWebhook?: boolean; paymentId?: string | null },
): Promise<{ installment: InstallmentDto; totals: OrderTotals }> {
  ensureDb()

  const validated = validateInput(input)
  if (!validated.ok) {
    throw new Error(validated.error)
  }

  return await prisma.$transaction(async (tx) => {
    // Lock pessimista no Order pra serializar com outras mutacoes (R3)
    await tx.$executeRawUnsafe(
      `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
      orderId,
    )

    const orderExists = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    })
    if (!orderExists) {
      throw new Error('Pedido nao encontrado')
    }

    const lastSeq = await (tx as any).paymentInstallment.findFirst({
      where: { orderId },
      select: { sequence: true },
      orderBy: { sequence: 'desc' },
    })
    const nextSeq = (lastSeq?.sequence || 0) + 1

    const created = await (tx as any).paymentInstallment.create({
      data: {
        orderId,
        sequence: nextSeq,
        amount: validated.data.amount,
        method: validated.data.method,
        description: validated.data.description,
        receivedAt: new Date(validated.data.receivedAt),
        receivedByEmail: by.isWebhook ? 'system' : by.email,
        notes: validated.data.notes,
        isRefund: validated.data.isRefund,
        paymentId: by.paymentId || null,
      },
    })

    const totals = await recalculatePaidAmount(orderId, tx)

    return { installment: serializeInstallment(created), totals }
  })
}

/**
 * Lista installments ativas (deletedAt IS NULL) de um pedido, em ordem
 * cronologica (sequence ASC).
 */
export async function listInstallmentsByOrder(orderId: string): Promise<InstallmentDto[]> {
  ensureDb()
  const rows = await installmentClient().findMany({
    where: { orderId, deletedAt: null },
    orderBy: { sequence: 'asc' },
  })
  return rows.map(serializeInstallment)
}

/**
 * Edita uma installment existente. Recalcula totals.
 * Apenas amount, method, description, receivedAt, notes podem mudar.
 * Nao permite mudar isRefund nem paymentId (use delete+create).
 */
export async function updateInstallment(
  installmentId: string,
  input: Partial<InstallmentInput>,
  by: { email: string },
): Promise<{ installment: InstallmentDto; totals: OrderTotals }> {
  ensureDb()

  return await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).paymentInstallment.findUnique({
      where: { id: installmentId },
      select: { id: true, orderId: true, deletedAt: true },
    })
    if (!existing || existing.deletedAt) {
      throw new Error('Parcela nao encontrada')
    }

    // Lock pessimista no Order (R3)
    await tx.$executeRawUnsafe(
      `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
      existing.orderId,
    )

    const data: Record<string, unknown> = {}
    if (input.amount !== undefined) {
      const tempInput = { ...input, amount: input.amount, method: 'cash' }
      const v = validateInput(tempInput as InstallmentInput)
      if (!v.ok) throw new Error(v.error)
      data.amount = v.data.amount
    }
    if (input.method !== undefined) {
      if (!VALID_METHODS.has(input.method)) {
        throw new Error(`method deve ser um de: ${[...VALID_METHODS].join(', ')}`)
      }
      data.method = input.method
    }
    if (input.description !== undefined) {
      data.description = typeof input.description === 'string' ? input.description.slice(0, 500) : null
    }
    if (input.receivedAt !== undefined) {
      data.receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date()
    }
    if (input.notes !== undefined) {
      data.notes = typeof input.notes === 'string' ? input.notes.slice(0, 1000) : null
    }

    const updated = await (tx as any).paymentInstallment.update({
      where: { id: installmentId },
      data,
    })

    const totals = await recalculatePaidAmount(existing.orderId, tx)
    return { installment: serializeInstallment(updated), totals }
  })
}

/**
 * Soft-delete: marca deletedAt e recalcula totals. Reason fica em
 * AuditLog (responsabilidade do caller). Nao deleta fisicamente —
 * historico financeiro preservado.
 */
export async function softDeleteInstallment(
  installmentId: string,
  by: { email: string },
): Promise<{ totals: OrderTotals; orderId: string }> {
  ensureDb()

  return await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).paymentInstallment.findUnique({
      where: { id: installmentId },
      select: { id: true, orderId: true, deletedAt: true },
    })
    if (!existing || existing.deletedAt) {
      throw new Error('Parcela nao encontrada')
    }

    await tx.$executeRawUnsafe(
      `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
      existing.orderId,
    )

    await (tx as any).paymentInstallment.update({
      where: { id: installmentId },
      data: { deletedAt: new Date() },
    })

    const totals = await recalculatePaidAmount(existing.orderId, tx)
    return { totals, orderId: existing.orderId }
  })
}
