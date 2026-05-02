import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

export type Product = {
  id: string
  name: string
  slug: string
  price: number
  category: string
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
  shippingAddress: {
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }
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
}

export type Banner = {
  id: string
  title: string
  subtitle: string
  imageUrl: string
  ctaText: string
  ctaLink: string
  isActive: boolean
  displayDurationSeconds: number
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

export type Database = {
  products: Product[]
  categories: Category[]
  orders: Order[]
  banners: Banner[]
  users: User[]
  customerAddresses: CustomerAddress[]
  webhookEvents: WebhookEvent[]
  productionTasks: ProductionTaskRecord[]
  productionLogs: ProductionLogRecord[]
  productionSettings: ProductionSettingsRecord[]
  coupons: CouponRecord[]
  productVariants: ProductVariantRecord[]
  wishlistItems: WishlistItemRecord[]
}

const defaultData: Database = {
  products: [],
  categories: [],
  orders: [],
  banners: [
    {
      id: 'banner_default',
      title: 'Presentes feitos para durar.',
      subtitle: 'Cada peça é impressa sob demanda com filamento premium. Personalize com nome, data ou mensagem especial.',
      imageUrl: '',
      ctaText: 'Explorar coleção',
      ctaLink: '/produtos',
      isActive: true,
      displayDurationSeconds: 5,
    },
  ],
  users: [],
  customerAddresses: [],
  webhookEvents: [],
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
      productionTasks: parsed.productionTasks || [],
      productionLogs: parsed.productionLogs || [],
      productionSettings:
        Array.isArray(parsed.productionSettings) && parsed.productionSettings.length > 0
          ? parsed.productionSettings
          : defaultData.productionSettings,
      coupons: parsed.coupons || [],
      productVariants: parsed.productVariants || [],
      wishlistItems: parsed.wishlistItems || [],
    }
  } catch {
    return defaultData
  }
}

export function writeDB(data: Database): void {
  ensureDir()
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}
