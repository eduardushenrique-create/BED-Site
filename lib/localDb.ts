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
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  paymentMethod: string
  createdAt: string
  items: { productId: string; productName: string; quantity: number; unitPrice: number; observation?: string }[]
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
}

export type User = {
  id: string
  name: string
  email: string
  phone?: string
  passwordHash?: string
  googleId?: string
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export type Database = {
  products: Product[]
  categories: Category[]
  orders: Order[]
  banners: Banner[]
  users: User[]
}

const defaultData: Database = {
  products: [],
  categories: [],
  orders: [],
  banners: [],
  users: [],
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
    }
  } catch {
    return defaultData
  }
}

export function writeDB(data: Database): void {
  ensureDir()
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}
