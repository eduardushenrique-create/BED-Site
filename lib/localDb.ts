import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

export type Product = {
  id: string
  name: string
  slug: string
  price: number
  categories: string[]
  isActive: boolean
  isFeatured: boolean
  isPersonalizable: boolean
  status: string
  description?: string
  imageUrl?: string
  stock: number
  underOrder: boolean
  sku?: string
  productionMinutesPerUnit?: number | null
  visibility?: 'public' | 'internal'
}

export type Category = {
  id: string
  name: string
  slug: string
  isActive: boolean
  description?: string
}

export type Order = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerCpf?: string
  // Pipeline-redesign: pedido com retirada (deliveryMethod='pickup') nao
  // precisa de endereco — pode vir null.
  shippingAddress: {
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  } | null
  deliveryMethod?: 'shipping' | 'pickup'
  total: number
  subtotal: number
  shippingCost: number
  discountTotal?: number
  couponCode?: string | null
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  paymentMethod: string
  paymentDetails?: {
    provider: string
    providerPaymentId?: string
    method: string
    status: string
    statusDetail?: string
    checkoutUrl?: string
    pixQrCode?: string
    pixQrCodeBase64?: string
    pixCopyPaste?: string
  }
  createdAt: string
  items: { productId: string; productName: string; variantId?: string | null; variantName?: string | null; quantity: number; unitPrice: number; observation?: string }[]
  trackingCode: string | null
  expectedDeliveryAt?: string | null
  productionTimeline?: Record<string, string | null> | null
  currentStageNote?: string | null
}

export type Banner = {
  id: string
  title: string
  htmlContent: string
  isActive: boolean
  displayDurationSeconds: number
  displayOrder: number
}

export type User = {
  id: string
  name: string
  email: string
  phone?: string
  cpf?: string
  passwordHash?: string
  googleId?: string
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export type CustomerAddress = {
  id: string
  customerId: string
  label?: string
  recipient: string
  zipCode: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  country: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type WebhookEvent = {
  id: string
  provider: string
  deliveryKey: string
  topic: string
  resourceId?: string
  eventId?: string
  action?: string
  orderNumber?: string
  paymentId?: string
  payloadHash: string
  signature?: string
  status: string
  receivedAt: string
  processedAt?: string
  lastError?: string
  updatedAt: string
}

export type ProductionTaskRecord = {
  id: string
  orderId: string
  orderItemId: string
  requiredQuantity: number
  producedQuantity: number
  status: string
  priority: string
  dueAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type ProductionLogRecord = {
  id: string
  taskId: string
  quantityDelta: number
  quantityAfter: number
  statusBefore?: string | null
  statusAfter?: string | null
  note?: string | null
  createdByEmail?: string | null
  createdByName?: string | null
  createdAt: string
}

export type ProductionSettingsRecord = {
  id: string
  dailyCapacityMinutes: number
  riskBufferHours: number
  businessDaysOnly: boolean
  createdAt: string
  updatedAt: string
}

export type ProductVariantRecord = {
  id: string
  productId: string
  name: string
  sku?: string | null
  color?: string | null
  size?: string | null
  material?: string | null
  finish?: string | null
  priceDelta?: number | null
  priceOverride?: number | null
  stockQuantity: number
  isAvailable: boolean
  createdAt: string
  updatedAt: string
}

export type CouponRecord = {
  id: string
  code: string
  type: 'fixed' | 'percentage'
  value: number
  minSubtotal: number | null
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
}

export type WishlistItemRecord = {
  id: string
  customerId: string
  productId: string
  createdAt: string
}

export type PrinterRecord = {
  id: string
  name: string
  model?: string | null
  buildVolume?: string | null
  materials?: string | null
  dailyCapacityMinutes: number
  status: 'active' | 'maintenance' | 'offline'
  color?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type ReviewRecord = {
  id: string
  productId: string
  customerId?: string | null
  customerName: string
  customerEmail: string
  orderNumber?: string | null
  rating: number
  title?: string | null
  body?: string | null
  status: 'pending' | 'approved' | 'hidden'
  moderatedAt?: string | null
  moderatedBy?: string | null
  createdAt: string
  updatedAt: string
}

export type AuditLogRecord = {
  id: string
  actorEmail: string
  actorRole?: string | null
  action: string
  targetType: string
  targetId?: string | null
  summary?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
  createdAt: string
}

export type RestockAlertRecord = {
  id: string
  email: string
  productId: string
  variantId?: string | null
  notifiedAt?: string | null
  createdAt: string
}

export type PasswordResetTokenRecord = {
  id: string
  adminUserId: string
  tokenHash: string
  expiresAt: string
  usedAt?: string | null
  createdAt: string
}

export type ExpenseCategoryRecord = {
  id: string
  name: string
  slug: string
  description?: string | null
  defaultType?: string | null
  costCenter?: string | null
  color?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ExpenseRecord = {
  id: string
  title: string
  description?: string | null
  /** Sempre armazenado como string para evitar perda de precisão (Decimal). */
  amount: string
  categoryId: string
  type: string // fixed | variable | one_off | recurring
  status: string // pending | paid | canceled
  paymentMethod?: string | null
  costCenter: string
  competenceDate: string // ISO
  dueDate?: string | null
  paidAt?: string | null
  receiptUrl?: string | null
  invoiceNumber?: string | null
  supplierName?: string | null
  relatedFilamentId?: string | null
  relatedComponentId?: string | null
  relatedPrinterId?: string | null
  notes?: string | null
  createdByEmail?: string | null
  updatedByEmail?: string | null
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
  isRecurring: boolean
  recurrenceRule?: string | null
  recurrenceParentId?: string | null
}

export type ExpenseBudgetRecord = {
  id: string
  categoryId: string
  month: number // 1-12
  year: number
  plannedAmount: string // decimal serializado
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type Database = {
  products: Product[]
  categories: Category[]
  orders: Order[]
  banners: Banner[]
  users: User[]
  customerAddresses: CustomerAddress[]
  webhookEvents: WebhookEvent[]
  printers: PrinterRecord[]
  productionTasks: ProductionTaskRecord[]
  productionLogs: ProductionLogRecord[]
  productionSettings: ProductionSettingsRecord[]
  coupons: CouponRecord[]
  productVariants: ProductVariantRecord[]
  wishlistItems: WishlistItemRecord[]
  passwordResetTokens: PasswordResetTokenRecord[]
  restockAlerts: RestockAlertRecord[]
  auditLogs: AuditLogRecord[]
  reviews: ReviewRecord[]
  expenseCategories: ExpenseCategoryRecord[]
  expenses: ExpenseRecord[]
  expenseBudgets: ExpenseBudgetRecord[]
}

const defaultData: Database = {
  products: [],
  categories: [],
  orders: [],
  banners: [
    {
      id: 'banner_default',
      title: 'Banner de exemplo',
      htmlContent: '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1D2235 0%,#2E3650 100%);color:#F0F5FB;font-family:sans-serif;font-size:22px;font-weight:600;">Configure seus banners no painel admin.</div>',
      isActive: true,
      displayDurationSeconds: 5,
      displayOrder: 0,
    },
  ],
  users: [],
  customerAddresses: [],
  webhookEvents: [],
  printers: [],
  productionTasks: [],
  productionLogs: [],
  productionSettings: [
    {
      id: 'default',
      dailyCapacityMinutes: 480,
      riskBufferHours: 24,
      businessDaysOnly: false,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  ],
  coupons: [],
  productVariants: [],
  wishlistItems: [],
  passwordResetTokens: [],
  restockAlerts: [],
  auditLogs: [],
  reviews: [],
  expenseCategories: [],
  expenses: [],
  expenseBudgets: [],
}

function ensureDir() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function readDB(): Database {
  ensureDir()
  if (!fs.existsSync(DB_PATH)) {
    writeDB(defaultData)
    return defaultData
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    return {
      ...defaultData,
      ...parsed,
      products: parsed.products || [],
      categories: parsed.categories || [],
      orders: parsed.orders || [],
      banners: parsed.banners || [],
      users: parsed.users || [],
      webhookEvents: parsed.webhookEvents || [],
      customerAddresses: parsed.customerAddresses || [],
      printers: parsed.printers || [],
      productionTasks: parsed.productionTasks || [],
      productionLogs: parsed.productionLogs || [],
      productionSettings:
        Array.isArray(parsed.productionSettings) && parsed.productionSettings.length > 0
          ? parsed.productionSettings
          : defaultData.productionSettings,
      coupons: parsed.coupons || [],
      productVariants: parsed.productVariants || [],
      wishlistItems: parsed.wishlistItems || [],
      passwordResetTokens: parsed.passwordResetTokens || [],
      restockAlerts: parsed.restockAlerts || [],
      auditLogs: parsed.auditLogs || [],
      reviews: parsed.reviews || [],
      expenseCategories: parsed.expenseCategories || [],
      expenses: parsed.expenses || [],
      expenseBudgets: parsed.expenseBudgets || [],
    }
  } catch {
    return defaultData
  }
}

export function writeDB(data: Database): void {
  ensureDir()
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}
