export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  
  if (cleaned.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i)
  }
  let digit1 = (sum * 10) % 11
  if (digit1 === 10) digit1 = 0

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i)
  }
  let digit2 = (sum * 10) % 11
  if (digit2 === 10) digit2 = 0

  return digit1 === parseInt(cleaned[9]) && digit2 === parseInt(cleaned[10])
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return `${cleaned.slice(0,3)}.${cleaned.slice(3)}`
  if (cleaned.length <= 9) return `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6)}`
  return `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6,9)}-${cleaned.slice(9,11)}`
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length <= 2) return `(${cleaned}`
  if (cleaned.length <= 7) return `(${cleaned.slice(0,2)}) ${cleaned.slice(2)}`
  return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7,11)}`
}

export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '')
  if (cleaned.length <= 5) return cleaned
  return `${cleaned.slice(0,5)}-${cleaned.slice(5,8)}`
}

export function validateCEP(cep: string): boolean {
  const cleaned = cep.replace(/\D/g, '')
  return cleaned.length === 8
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',')
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Expense validation (manual, no zod dependency)
// ---------------------------------------------------------------------------

const RECEIPT_URL_ALLOWLIST = [
  'drive.google.com',
  'dropbox.com',
  'mercadopago.com.br',
  'mercadolivre.com.br',
]

export function validateReceiptUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return RECEIPT_URL_ALLOWLIST.some(
      domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain),
    )
  } catch {
    return false
  }
}

export type ExpenseInputErrors = Record<string, string>

export type ExpenseInput = {
  title?: unknown
  description?: unknown
  amount?: unknown
  categoryId?: unknown
  type?: unknown
  status?: unknown
  paymentMethod?: unknown
  costCenter?: unknown
  competenceDate?: unknown
  dueDate?: unknown
  paidAt?: unknown
  receiptUrl?: unknown
  invoiceNumber?: unknown
  supplierName?: unknown
  relatedFilamentId?: unknown
  relatedComponentId?: unknown
  relatedPrinterId?: unknown
  notes?: unknown
  isRecurring?: unknown
  recurrenceRule?: unknown
  recurrenceParentId?: unknown
}

const VALID_TYPES = ['fixed', 'variable', 'one_time'] as const
const VALID_STATUSES = ['pending', 'paid', 'canceled'] as const
const VALID_PAYMENT_METHODS = [
  'pix', 'credit_card', 'debit_card', 'bank_slip', 'bank_transfer', 'cash', 'mercado_pago', 'other',
] as const
const VALID_COST_CENTERS = [
  'production', 'platform', 'marketing', 'administrative', 'logistics', 'financial', 'other',
] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/

function isValidDate(v: unknown): boolean {
  if (typeof v !== 'string') return false
  if (!DATE_RE.test(v)) return false
  const d = new Date(v)
  return !isNaN(d.getTime())
}

export function validateExpenseInput(
  body: ExpenseInput,
  opts: { requireAllFields?: boolean } = {},
): { errors: ExpenseInputErrors; valid: boolean } {
  const errors: ExpenseInputErrors = {}
  const req = opts.requireAllFields ?? true

  if (req || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length < 3) {
      errors.title = 'Título deve ter pelo menos 3 caracteres.'
    } else if (body.title.trim().length > 200) {
      errors.title = 'Título deve ter no máximo 200 caracteres.'
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 2000) {
      errors.description = 'Descrição deve ter no máximo 2000 caracteres.'
    }
  }

  if (req || body.amount !== undefined) {
    if (typeof body.amount !== 'string' && typeof body.amount !== 'number') {
      errors.amount = 'Valor é obrigatório.'
    } else {
      const v = parseFloat(String(body.amount))
      if (!isFinite(v) || v <= 0) errors.amount = 'Valor deve ser maior que zero.'
    }
  }

  if (req || body.categoryId !== undefined) {
    if (typeof body.categoryId !== 'string' || !body.categoryId.trim()) {
      errors.categoryId = 'Categoria é obrigatória.'
    }
  }

  if (req || body.type !== undefined) {
    if (!(VALID_TYPES as readonly string[]).includes(body.type as string)) {
      errors.type = `Tipo inválido. Use: ${VALID_TYPES.join(', ')}.`
    }
  }

  if (req || body.status !== undefined) {
    if (!(VALID_STATUSES as readonly string[]).includes(body.status as string)) {
      errors.status = `Status inválido. Use: ${VALID_STATUSES.join(', ')}.`
    }
  }

  if (body.paymentMethod !== undefined && body.paymentMethod !== null) {
    if (!(VALID_PAYMENT_METHODS as readonly string[]).includes(body.paymentMethod as string)) {
      errors.paymentMethod = `Forma de pagamento inválida. Use: ${VALID_PAYMENT_METHODS.join(', ')}.`
    }
  }

  if (body.costCenter !== undefined) {
    if (!(VALID_COST_CENTERS as readonly string[]).includes(body.costCenter as string)) {
      errors.costCenter = `Centro de custo inválido. Use: ${VALID_COST_CENTERS.join(', ')}.`
    }
  }

  if (req || body.competenceDate !== undefined) {
    if (!isValidDate(body.competenceDate)) {
      errors.competenceDate = 'Data de competência inválida.'
    }
  }

  if (body.dueDate !== undefined && body.dueDate !== null) {
    if (!isValidDate(body.dueDate)) {
      errors.dueDate = 'Data de vencimento inválida.'
    }
  }

  if (body.paidAt !== undefined && body.paidAt !== null) {
    if (!isValidDate(body.paidAt)) {
      errors.paidAt = 'Data de pagamento inválida.'
    }
    // paidAt only allowed when status is 'paid'
    if (body.status !== 'paid') {
      errors.paidAt = 'paidAt só é permitido quando status é paid.'
    }
  }

  if (body.receiptUrl !== undefined && body.receiptUrl !== null && body.receiptUrl !== '') {
    if (typeof body.receiptUrl !== 'string' || !validateReceiptUrl(body.receiptUrl)) {
      errors.receiptUrl = 'URL de comprovante inválida ou domínio não permitido.'
    }
  }

  if (body.invoiceNumber !== undefined && body.invoiceNumber !== null) {
    if (typeof body.invoiceNumber !== 'string' || body.invoiceNumber.length > 100) {
      errors.invoiceNumber = 'Número de nota fiscal deve ter no máximo 100 caracteres.'
    }
  }

  if (body.supplierName !== undefined && body.supplierName !== null) {
    if (typeof body.supplierName !== 'string' || body.supplierName.length > 120) {
      errors.supplierName = 'Nome do fornecedor deve ter no máximo 120 caracteres.'
    }
  }

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 2000) {
      errors.notes = 'Notas devem ter no máximo 2000 caracteres.'
    }
  }

  return { errors, valid: Object.keys(errors).length === 0 }
}

export type ExpenseCategoryInput = {
  name?: unknown
  slug?: unknown
  description?: unknown
  defaultType?: unknown
  costCenter?: unknown
  color?: unknown
  isActive?: unknown
}

export function validateExpenseCategoryInput(
  body: ExpenseCategoryInput,
  opts: { requireAllFields?: boolean } = {},
): { errors: ExpenseInputErrors; valid: boolean } {
  const errors: ExpenseInputErrors = {}
  const req = opts.requireAllFields ?? true

  if (req || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      errors.name = 'Nome deve ter pelo menos 2 caracteres.'
    } else if (body.name.trim().length > 100) {
      errors.name = 'Nome deve ter no máximo 100 caracteres.'
    }
  }

  if (req || body.slug !== undefined) {
    if (typeof body.slug !== 'string' || body.slug.trim().length < 2) {
      errors.slug = 'Slug deve ter pelo menos 2 caracteres.'
    } else if (body.slug.trim().length > 100) {
      errors.slug = 'Slug deve ter no máximo 100 caracteres.'
    } else if (!/^[a-z0-9-]+$/.test(body.slug.trim())) {
      errors.slug = 'Slug deve conter apenas letras minúsculas, números e hífens.'
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 500) {
      errors.description = 'Descrição deve ter no máximo 500 caracteres.'
    }
  }

  if (body.defaultType !== undefined && body.defaultType !== null) {
    if (!(VALID_TYPES as readonly string[]).includes(body.defaultType as string)) {
      errors.defaultType = `Tipo padrão inválido. Use: ${VALID_TYPES.join(', ')}.`
    }
  }

  if (body.costCenter !== undefined && body.costCenter !== null) {
    if (!(VALID_COST_CENTERS as readonly string[]).includes(body.costCenter as string)) {
      errors.costCenter = `Centro de custo inválido. Use: ${VALID_COST_CENTERS.join(', ')}.`
    }
  }

  if (body.color !== undefined && body.color !== null && body.color !== '') {
    if (typeof body.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      errors.color = 'Cor deve estar no formato #RRGGBB.'
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.isActive = 'isActive deve ser booleano.'
  }

  return { errors, valid: Object.keys(errors).length === 0 }
}