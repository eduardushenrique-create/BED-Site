/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  readDB,
  writeDB,
  Product,
  Category,
  Order,
  Banner,
  User,
  CustomerAddress,
  WebhookEvent,
  ProductionTaskRecord,
  ProductionLogRecord,
  ProductionSettingsRecord,
} from '@/lib/localDb'
import {
  serializeProductionTask,
  serializeCustomerProduction,
  calculateProductionRisk,
  calculateProductionProgress,
  getProductionUnitMinutes,
  type ProductionTaskStatus,
  type ProductionPriority,
  type ProductionRiskLevel,
  type ProductionSettingsLike,
  type SerializedProductionTaskAdmin,
  type SerializedCustomerProduction,
} from '@/lib/production'
import type {
  ProductionTaskFilters,
  ProductionTaskSummary,
  ProductionPagination,
  ProductionLogEntry,
  ProductionSettingsDto,
  UpdateProductionTaskInput,
  UpdateProductionTaskActor,
  UpdateProductionSettingsInput,
} from '@/lib/types'

const databaseUrl = process.env.DATABASE_URL || ''
export const hasDatabase = Boolean(databaseUrl && !databaseUrl.includes('johndoe:randompassword'))

type WebhookEventUpsert = {
  provider: string
  deliveryKey: string
  topic: string
  resourceId?: string
  eventId?: string
  action?: string
  orderNumber?: string
  paymentId?: string
  payloadHash: string
  signature?: string | null
}

type WebhookEventUpdate = {
  status: string
  processedAt?: string | Date | null
  lastError?: string | null
  orderNumber?: string | null
  paymentId?: string | null
}

function money(value: number) {
  return Number(value || 0)
}

function serializeProduct(product: any): Product {
  const image = product.images?.find((img: any) => img.isMain) || product.images?.[0]

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: money(product.price),
    category: product.category?.slug || product.category || '',
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isPersonalizable: product.isPersonalizable,
    status: product.status,
    description: product.description || product.shortDescription || '',
    imageUrl: image?.url || product.imageUrl || '',
    stock: product.stock || 0,
    underOrder: product.underOrder || false,
    sku: product.sku || '',
  }
}

function serializeCategory(category: any): Category {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    isActive: category.isActive,
    description: category.description || '',
  }
}

function serializeCustomer(customer: any): User {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone || undefined,
    cpf: customer.cpf || undefined,
    isVerified: customer.isVerified,
    createdAt: customer.createdAt instanceof Date ? customer.createdAt.toISOString() : customer.createdAt,
    updatedAt: customer.updatedAt instanceof Date ? customer.updatedAt.toISOString() : customer.updatedAt,
  }
}

function serializeAddress(address: any): CustomerAddress {
  return {
    id: address.id,
    customerId: address.customerId,
    label: address.label || undefined,
    recipient: address.recipient,
    zipCode: address.zipCode,
    street: address.street,
    number: address.number,
    complement: address.complement || undefined,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    country: address.country,
    isDefault: address.isDefault,
    createdAt: address.createdAt instanceof Date ? address.createdAt.toISOString() : address.createdAt,
    updatedAt: address.updatedAt instanceof Date ? address.updatedAt.toISOString() : address.updatedAt,
  }
}

function serializeBanner(banner: any): Banner {
  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle || '',
    imageUrl: banner.imageUrl,
    ctaText: banner.ctaText || '',
    ctaLink: banner.ctaLink || '',
    isActive: banner.isActive,
    displayDurationSeconds: typeof banner.displayDurationSeconds === 'number' ? banner.displayDurationSeconds : 5,
  }
}

function serializeOrder(order: any): Order {
  const paymentPayload = order.payment?.rawPayload && typeof order.payment.rawPayload === 'object'
    ? order.payment.rawPayload
    : null

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone || '',
    shippingAddress: {
      street: order.address?.street || '',
      number: order.address?.number || '',
      complement: order.address?.complement || '',
      neighborhood: order.address?.neighborhood || '',
      city: order.address?.city || '',
      state: order.address?.state || '',
      zipCode: order.address?.zipCode || '',
    },
    total: money(order.total),
    subtotal: money(order.subtotal),
    shippingCost: money(order.shippingTotal),
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentMethod: order.payment?.method || order.paymentMethod || 'manual',
    paymentDetails: order.payment
      ? {
          provider: order.payment.provider,
          providerPaymentId: order.payment.providerPaymentId || undefined,
          method: order.payment.method,
          status: order.payment.status,
          statusDetail: paymentPayload?.status_detail || undefined,
          checkoutUrl: paymentPayload?.checkoutUrl || paymentPayload?.initPoint || undefined,
          pixQrCode: paymentPayload?.pixQrCodeBase64 || undefined,
          pixQrCodeBase64: paymentPayload?.pixQrCodeBase64 || undefined,
          pixCopyPaste: order.payment.pixCopyPaste || paymentPayload?.pixCopyPaste || undefined,
        }
      : undefined,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    items: (order.items || []).map((item: any) => ({
      productId: item.productId,
      productName: item.productNameSnapshot || item.productName,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      observation: item.personalizationJson || item.observation || undefined,
    })),
    trackingCode: order.trackingCode || null,
  }
}

export async function listProducts() {
  if (!hasDatabase || !prisma?.product) {
    return readDB().products
  }

  try {
    const products = await prisma.product.findMany({
      include: { category: true, images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    })

    return products.map(serializeProduct)
  } catch (error) {
    console.error('[database] listProducts Prisma failed, using fallback:', error)
    return readDB().products
  }
}

export async function createProduct(data: Product) {
  if (!hasDatabase || !prisma?.product) {
    const db = readDB()
    const newProduct: Product = { ...data, id: `prod_${Date.now()}` }
    db.products.push(newProduct)
    writeDB(db)
    return newProduct
  }

  try {
    const category = data.category
      ? await prisma.category.findUnique({ where: { slug: data.category } })
      : null

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        sku: data.sku || null,
        description: data.description || null,
        shortDescription: data.description || null,
        price: data.price,
        categoryId: category?.id || null,
        isPersonalizable: data.isPersonalizable,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        status: data.status,
        stock: data.stock || 0,
        underOrder: data.underOrder || false,
        images: data.imageUrl
          ? { create: [{ url: data.imageUrl, alt: data.name, isMain: true }] }
          : undefined,
      },
      include: { category: true, images: true },
    })

    return serializeProduct(product)
  } catch (error) {
    console.error('[database] createProduct Prisma failed, using fallback:', error)
    const db = readDB()
    const newProduct: Product = { ...data, id: `prod_${Date.now()}` }
    db.products.push(newProduct)
    writeDB(db)
    return newProduct
  }
}

export async function updateProduct(id: string, data: Partial<Product>) {
  if (!hasDatabase || !prisma?.product) {
    const db = readDB()
    const index = db.products.findIndex(product => product.id === id)
    if (index === -1) return null
    db.products[index] = { ...db.products[index], ...data }
    writeDB(db)
    return db.products[index]
  }

  try {
    const category = data.category
      ? await prisma.category.findUnique({ where: { slug: data.category } })
      : undefined

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        sku: data.sku,
        description: data.description,
        shortDescription: data.description,
        price: data.price,
        categoryId: category ? category.id : undefined,
        isPersonalizable: data.isPersonalizable,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        status: data.status,
        stock: data.stock,
        underOrder: data.underOrder,
      },
      include: { category: true, images: true },
    })

    if (data.imageUrl !== undefined) {
      // Substitui apenas a imagem principal existente; preserva as demais imagens da galeria
      const existingMain = await prisma.productImage.findFirst({ where: { productId: id, isMain: true } })
      if (data.imageUrl) {
        if (existingMain) {
          await prisma.productImage.update({
            where: { id: existingMain.id },
            data: { url: data.imageUrl, alt: product.name },
          })
        } else {
          await prisma.productImage.create({
            data: { productId: id, url: data.imageUrl, alt: product.name, isMain: true },
          })
        }
      } else if (existingMain) {
        const next = await prisma.productImage.findFirst({
          where: { productId: id, NOT: { id: existingMain.id } },
          orderBy: { sortOrder: 'asc' },
        })
        if (next) {
          await prisma.$transaction([
            prisma.productImage.delete({ where: { id: existingMain.id } }),
            prisma.productImage.update({ where: { id: next.id }, data: { isMain: true } }),
          ])
        } else {
          await prisma.productImage.delete({ where: { id: existingMain.id } })
        }
      }
    }

    return serializeProduct(await prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true, images: true } }))
  } catch (error) {
    console.error('[database] updateProduct Prisma failed, using fallback:', error)
    const db = readDB()
    const index = db.products.findIndex(product => product.id === id)
    if (index === -1) return null
    db.products[index] = { ...db.products[index], ...data }
    writeDB(db)
    return db.products[index]
  }
}

export type ProductImageDto = {
  id: string
  url: string
  alt: string | null
  sortOrder: number
  isMain: boolean
}

const MAX_PRODUCT_IMAGES = 8

function serializeProductImage(img: any): ProductImageDto {
  return {
    id: img.id,
    url: img.url,
    alt: img.alt || null,
    sortOrder: img.sortOrder,
    isMain: img.isMain,
  }
}

export async function listProductImages(productId: string): Promise<ProductImageDto[]> {
  if (!hasDatabase || !prisma?.productImage) return []
  try {
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
    })
    return images.map(serializeProductImage)
  } catch (error) {
    console.error('[database] listProductImages Prisma failed:', error)
    return []
  }
}

export async function addProductImage(productId: string, data: { url: string; alt?: string }): Promise<{ image: ProductImageDto | null; error?: string }> {
  if (!hasDatabase || !prisma?.productImage || !prisma?.product) {
    return { image: null, error: 'Banco de dados indisponível.' }
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { _count: { select: { images: true } } } })
    if (!product) return { image: null, error: 'Produto não encontrado.' }
    if (product._count.images >= MAX_PRODUCT_IMAGES) {
      return { image: null, error: `Limite de ${MAX_PRODUCT_IMAGES} imagens por produto.` }
    }

    const isFirst = product._count.images === 0
    const maxSortOrder = await prisma.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } })
    const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

    const image = await prisma.productImage.create({
      data: {
        productId,
        url: data.url,
        alt: data.alt || product.name,
        sortOrder,
        isMain: isFirst,
      },
    })
    return { image: serializeProductImage(image) }
  } catch (error) {
    console.error('[database] addProductImage Prisma failed:', error)
    return { image: null, error: 'Erro ao salvar imagem.' }
  }
}

export async function removeProductImage(productId: string, imageId: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productImage) {
    return { ok: false, error: 'Banco de dados indisponível.' }
  }

  try {
    const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } })
    if (!image) return { ok: false, error: 'Imagem não encontrada.' }

    await prisma.$transaction(async tx => {
      await tx.productImage.delete({ where: { id: imageId } })
      if (image.isMain) {
        const next = await tx.productImage.findFirst({
          where: { productId },
          orderBy: { sortOrder: 'asc' },
        })
        if (next) {
          await tx.productImage.update({ where: { id: next.id }, data: { isMain: true } })
        }
      }
    })
    return { ok: true }
  } catch (error) {
    console.error('[database] removeProductImage Prisma failed:', error)
    return { ok: false, error: 'Erro ao remover imagem.' }
  }
}

export async function setMainProductImage(productId: string, imageId: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productImage) {
    return { ok: false, error: 'Banco de dados indisponível.' }
  }

  try {
    const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } })
    if (!image) return { ok: false, error: 'Imagem não encontrada.' }

    await prisma.$transaction([
      prisma.productImage.updateMany({ where: { productId, isMain: true }, data: { isMain: false } }),
      prisma.productImage.update({ where: { id: imageId }, data: { isMain: true } }),
    ])
    return { ok: true }
  } catch (error) {
    console.error('[database] setMainProductImage Prisma failed:', error)
    return { ok: false, error: 'Erro ao definir imagem principal.' }
  }
}

export async function reorderProductImages(productId: string, orderedIds: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productImage) {
    return { ok: false, error: 'Banco de dados indisponível.' }
  }

  try {
    const owned = await prisma.productImage.findMany({ where: { productId }, select: { id: true } })
    const ownedIds = new Set(owned.map(i => i.id))
    if (orderedIds.length !== owned.length || orderedIds.some(id => !ownedIds.has(id))) {
      return { ok: false, error: 'Lista de ordenação inválida.' }
    }

    const client = prisma
    await client.$transaction(
      orderedIds.map((id, index) =>
        client.productImage.update({ where: { id }, data: { sortOrder: index } })
      )
    )
    return { ok: true }
  } catch (error) {
    console.error('[database] reorderProductImages Prisma failed:', error)
    return { ok: false, error: 'Erro ao reordenar imagens.' }
  }
}

export async function deleteProduct(id: string) {
  if (!hasDatabase || !prisma?.product) {
    const db = readDB()
    const index = db.products.findIndex(product => product.id === id)
    if (index === -1) return false
    db.products.splice(index, 1)
    writeDB(db)
    return true
  }

  try {
    await prisma.product.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('[database] deleteProduct Prisma failed:', error)
    return false
  }
}

export type BulkProductUpdate = {
  isActive?: boolean
  isFeatured?: boolean
  isPersonalizable?: boolean
  underOrder?: boolean
  status?: string
  category?: string  // slug da categoria; '' significa remover categoria
}

export async function updateProductsBulk(ids: string[], updates: BulkProductUpdate): Promise<{ updated: number; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { updated: 0, error: 'Selecione ao menos um produto.' }
  }

  const data: Record<string, unknown> = {}
  if (typeof updates.isActive === 'boolean') data.isActive = updates.isActive
  if (typeof updates.isFeatured === 'boolean') data.isFeatured = updates.isFeatured
  if (typeof updates.isPersonalizable === 'boolean') data.isPersonalizable = updates.isPersonalizable
  if (typeof updates.underOrder === 'boolean') data.underOrder = updates.underOrder
  if (typeof updates.status === 'string' && updates.status) data.status = updates.status

  // Quando admin alterna isActive, sincronizamos status para que o filtro público (status != draft) reaja
  if (typeof updates.isActive === 'boolean' && typeof updates.status !== 'string') {
    data.status = updates.isActive ? 'published' : 'draft'
  }

  if (typeof updates.category === 'string') {
    if (updates.category === '') {
      data.categoryId = null
    } else if (hasDatabase && prisma?.category) {
      try {
        const cat = await prisma.category.findUnique({ where: { slug: updates.category } })
        if (!cat) return { updated: 0, error: `Categoria "${updates.category}" não encontrada.` }
        data.categoryId = cat.id
      } catch (error) {
        console.error('[database] updateProductsBulk category lookup failed:', error)
        return { updated: 0, error: 'Erro ao validar categoria.' }
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return { updated: 0, error: 'Nenhuma alteração válida informada.' }
  }

  if (!hasDatabase || !prisma?.product) {
    const db = readDB()
    let count = 0
    db.products.forEach(p => {
      if (!ids.includes(p.id)) return
      if (typeof data.isActive === 'boolean') p.isActive = data.isActive as boolean
      if (typeof data.isFeatured === 'boolean') p.isFeatured = data.isFeatured as boolean
      if (typeof data.isPersonalizable === 'boolean') p.isPersonalizable = data.isPersonalizable as boolean
      if (typeof data.underOrder === 'boolean') p.underOrder = data.underOrder as boolean
      if (typeof data.status === 'string') p.status = data.status as string
      if (typeof updates.category === 'string') p.category = updates.category
      count++
    })
    writeDB(db)
    return { updated: count }
  }

  try {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data,
    })
    return { updated: result.count }
  } catch (error) {
    console.error('[database] updateProductsBulk Prisma failed:', error)
    return { updated: 0, error: 'Erro ao atualizar produtos no banco.' }
  }
}

export async function listCategories() {
  if (!hasDatabase || !prisma?.category) return readDB().categories
  try {
    const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    return categories.map(serializeCategory)
  } catch (error) {
    console.error('[database] listCategories Prisma failed, using fallback:', error)
    return readDB().categories
  }
}

export async function createCategory(data: Category) {
  if (!hasDatabase || !prisma?.category) {
    const db = readDB()
    const newCategory: Category = { ...data, id: `cat_${Date.now()}` }
    db.categories.push(newCategory)
    writeDB(db)
    return newCategory
  }

  try {
    return serializeCategory(await prisma.category.create({ data }))
  } catch (error) {
    console.error('[database] createCategory Prisma failed, using fallback:', error)
    const db = readDB()
    const newCategory: Category = { ...data, id: `cat_${Date.now()}` }
    db.categories.push(newCategory)
    writeDB(db)
    return newCategory
  }
}

export async function updateCategory(id: string, data: Partial<Category>) {
  if (!hasDatabase || !prisma?.category) {
    const db = readDB()
    const index = db.categories.findIndex(category => category.id === id)
    if (index === -1) return null
    db.categories[index] = { ...db.categories[index], ...data }
    writeDB(db)
    return db.categories[index]
  }

  try {
    return serializeCategory(await prisma.category.update({ where: { id }, data }))
  } catch (error) {
    console.error('[database] updateCategory Prisma failed, using fallback:', error)
    const db = readDB()
    const index = db.categories.findIndex(category => category.id === id)
    if (index === -1) return null
    db.categories[index] = { ...db.categories[index], ...data }
    writeDB(db)
    return db.categories[index]
  }
}

export async function deleteCategory(id: string) {
  if (!hasDatabase || !prisma?.category) {
    const db = readDB()
    const index = db.categories.findIndex(category => category.id === id)
    if (index === -1) return false
    db.categories.splice(index, 1)
    writeDB(db)
    return true
  }

  try {
    await prisma.category.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('[database] deleteCategory Prisma failed:', error)
    return false
  }
}

export async function listCustomers(q = '') {
  if (!hasDatabase || !prisma?.customer) {
    const users = readDB().users
    if (!q) return users
    const lower = q.toLowerCase()
    return users.filter(user =>
      user.name.toLowerCase().includes(lower) ||
      user.email.toLowerCase().includes(lower) ||
      (user.phone && user.phone.includes(lower))
    )
  }

  try {
    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return customers.map(serializeCustomer)
  } catch (error) {
    console.error('[database] listCustomers Prisma failed, using fallback:', error)
    return readDB().users
  }
}

export async function createCustomer(data: Pick<User, 'name' | 'email' | 'phone'>) {
  if (!hasDatabase || !prisma?.customer) {
    const db = readDB()
    const existing = db.users.find(user => user.email === data.email)
    if (existing) return null
    const newUser: User = {
      ...data,
      id: `user_${Date.now()}`,
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.users.push(newUser)
    writeDB(db)
    return newUser
  }

  try {
    return serializeCustomer(await prisma.customer.create({ data }))
  } catch (error) {
    console.error('[database] createCustomer Prisma failed, using fallback:', error)
    const db = readDB()
    const existing = db.users.find(user => user.email === data.email)
    if (existing) return null
    const newUser: User = {
      ...data,
      id: `user_${Date.now()}`,
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.users.push(newUser)
    writeDB(db)
    return newUser
  }
}

export async function updateCustomer(id: string, data: Partial<User>) {
  if (!hasDatabase || !prisma?.customer) {
    const db = readDB()
    const index = db.users.findIndex(user => user.id === id)
    if (index === -1) return null
    db.users[index] = { ...db.users[index], ...data, updatedAt: new Date().toISOString() }
    writeDB(db)
    return db.users[index]
  }

  try {
    return serializeCustomer(await prisma.customer.update({
      where: { id },
      data: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf },
    }))
  } catch (error) {
    console.error('[database] updateCustomer Prisma failed, using fallback:', error)
    const db = readDB()
    const index = db.users.findIndex(user => user.id === id)
    if (index === -1) return null
    db.users[index] = { ...db.users[index], ...data, updatedAt: new Date().toISOString() }
    writeDB(db)
    return db.users[index]
  }
}

export async function getCustomerById(id: string): Promise<User | null> {
  if (!hasDatabase || !prisma?.customer) {
    return readDB().users.find(user => user.id === id) || null
  }
  try {
    const customer = await prisma.customer.findUnique({ where: { id } })
    return customer ? serializeCustomer(customer) : null
  } catch (error) {
    console.error('[database] getCustomerById Prisma failed, using fallback:', error)
    return readDB().users.find(user => user.id === id) || null
  }
}

export async function getCustomerByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase()
  if (!hasDatabase || !prisma?.customer) {
    return readDB().users.find(user => user.email.toLowerCase() === normalized) || null
  }
  try {
    const customer = await prisma.customer.findUnique({ where: { email: normalized } })
    return customer ? serializeCustomer(customer) : null
  } catch (error) {
    console.error('[database] getCustomerByEmail Prisma failed, using fallback:', error)
    return readDB().users.find(user => user.email.toLowerCase() === normalized) || null
  }
}

export type ListOrdersByEmailOpts = {
  status?: string
  limit?: number
  offset?: number
}

export async function listOrdersByCustomerEmail(email: string, opts: ListOrdersByEmailOpts = {}) {
  const normalized = email.trim().toLowerCase()
  const limit = Math.min(Math.max(opts.limit || 20, 1), 50)
  const offset = Math.max(opts.offset || 0, 0)

  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    let filtered = db.orders.filter(o => o.customerEmail.toLowerCase() === normalized)
    if (opts.status) filtered = filtered.filter(o => o.status === opts.status)
    return {
      orders: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    }
  }

  try {
    const where: any = { customerEmail: { equals: normalized, mode: 'insensitive' } }
    if (opts.status) where.status = opts.status

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { address: true, payment: true, items: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.order.count({ where }),
    ])

    return {
      orders: orders.map(serializeOrder),
      total,
      limit,
      offset,
    }
  } catch (error) {
    console.error('[database] listOrdersByCustomerEmail Prisma failed, using fallback:', error)
    const db = readDB()
    let filtered = db.orders.filter(o => o.customerEmail.toLowerCase() === normalized)
    if (opts.status) filtered = filtered.filter(o => o.status === opts.status)
    return {
      orders: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    }
  }
}

export async function listAddressesByCustomerId(customerId: string): Promise<CustomerAddress[]> {
  if (!hasDatabase || !prisma?.customerAddress) {
    const db = readDB()
    return db.customerAddresses
      .filter(addr => addr.customerId === customerId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt))
  }
  try {
    const addresses = await prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return addresses.map(serializeAddress)
  } catch (error) {
    console.error('[database] listAddressesByCustomerId Prisma failed, using fallback:', error)
    const db = readDB()
    return db.customerAddresses
      .filter(addr => addr.customerId === customerId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt))
  }
}

export type AddressInput = {
  label?: string
  recipient: string
  zipCode: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  country?: string
  isDefault?: boolean
}

const MAX_ADDRESSES = 5

export async function createAddress(customerId: string, data: AddressInput): Promise<{ address: CustomerAddress | null; error?: string }> {
  const existing = await listAddressesByCustomerId(customerId)
  if (existing.length >= MAX_ADDRESSES) {
    return { address: null, error: `Limite de ${MAX_ADDRESSES} endereços por conta atingido.` }
  }

  const shouldBeDefault = data.isDefault === true || existing.length === 0

  if (!hasDatabase || !prisma?.customerAddress) {
    const db = readDB()
    if (shouldBeDefault) {
      db.customerAddresses.forEach(addr => {
        if (addr.customerId === customerId) addr.isDefault = false
      })
    }
    const now = new Date().toISOString()
    const newAddress: CustomerAddress = {
      id: `addr_${Date.now()}`,
      customerId,
      label: data.label,
      recipient: data.recipient,
      zipCode: data.zipCode,
      street: data.street,
      number: data.number,
      complement: data.complement,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      country: data.country || 'BR',
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now,
    }
    db.customerAddresses.push(newAddress)
    writeDB(db)
    return { address: newAddress }
  }

  try {
    const created = await prisma.$transaction(async tx => {
      if (shouldBeDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.customerAddress.create({
        data: {
          customerId,
          label: data.label,
          recipient: data.recipient,
          zipCode: data.zipCode,
          street: data.street,
          number: data.number,
          complement: data.complement,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          country: data.country || 'BR',
          isDefault: shouldBeDefault,
        },
      })
    })
    return { address: serializeAddress(created) }
  } catch (error) {
    console.error('[database] createAddress Prisma failed:', error)
    return { address: null, error: 'Não foi possível salvar o endereço.' }
  }
}

export async function updateAddress(customerId: string, id: string, data: Partial<AddressInput>): Promise<CustomerAddress | null> {
  if (!hasDatabase || !prisma?.customerAddress) {
    const db = readDB()
    const idx = db.customerAddresses.findIndex(a => a.id === id && a.customerId === customerId)
    if (idx === -1) return null
    if (data.isDefault === true) {
      db.customerAddresses.forEach(addr => {
        if (addr.customerId === customerId) addr.isDefault = false
      })
    }
    db.customerAddresses[idx] = {
      ...db.customerAddresses[idx],
      ...data,
      country: data.country || db.customerAddresses[idx].country,
      isDefault: data.isDefault ?? db.customerAddresses[idx].isDefault,
      updatedAt: new Date().toISOString(),
    }
    writeDB(db)
    return db.customerAddresses[idx]
  }

  try {
    const owned = await prisma.customerAddress.findFirst({ where: { id, customerId } })
    if (!owned) return null

    const updated = await prisma.$transaction(async tx => {
      if (data.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        })
      }
      return tx.customerAddress.update({
        where: { id },
        data: {
          label: data.label,
          recipient: data.recipient,
          zipCode: data.zipCode,
          street: data.street,
          number: data.number,
          complement: data.complement,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          country: data.country,
          isDefault: data.isDefault,
        },
      })
    })
    return serializeAddress(updated)
  } catch (error) {
    console.error('[database] updateAddress Prisma failed:', error)
    return null
  }
}

export async function deleteAddress(customerId: string, id: string): Promise<boolean> {
  if (!hasDatabase || !prisma?.customerAddress) {
    const db = readDB()
    const idx = db.customerAddresses.findIndex(a => a.id === id && a.customerId === customerId)
    if (idx === -1) return false
    const wasDefault = db.customerAddresses[idx].isDefault
    db.customerAddresses.splice(idx, 1)
    if (wasDefault) {
      const remaining = db.customerAddresses
        .filter(a => a.customerId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (remaining[0]) remaining[0].isDefault = true
    }
    writeDB(db)
    return true
  }

  try {
    const owned = await prisma.customerAddress.findFirst({ where: { id, customerId } })
    if (!owned) return false

    await prisma.$transaction(async tx => {
      await tx.customerAddress.delete({ where: { id } })
      if (owned.isDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
        })
        if (next) {
          await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } })
        }
      }
    })
    return true
  } catch (error) {
    console.error('[database] deleteAddress Prisma failed:', error)
    return false
  }
}

export async function listBanners() {
  if (!hasDatabase || !prisma?.banner) return readDB().banners
  try {
    const banners = await prisma.banner.findMany({ orderBy: { createdAt: 'desc' } })
    return banners.map(serializeBanner)
  } catch (error) {
    console.error('[database] listBanners Prisma failed, using fallback:', error)
    return readDB().banners
  }
}

export async function createBanner(data: Banner) {
  if (!hasDatabase || !prisma?.banner) {
    const db = readDB()
    const newBanner: Banner = { ...data, id: `banner_${Date.now()}` }
    db.banners.push(newBanner)
    writeDB(db)
    return newBanner
  }

  try {
    return serializeBanner(await prisma.banner.create({ data }))
  } catch (error) {
    console.error('[database] createBanner Prisma failed, using fallback:', error)
    const db = readDB()
    const newBanner: Banner = { ...data, id: `banner_${Date.now()}` }
    db.banners.push(newBanner)
    writeDB(db)
    return newBanner
  }
}

export async function updateBanner(id: string, data: Partial<Banner>) {
  if (!hasDatabase || !prisma?.banner) {
    const db = readDB()
    const index = db.banners.findIndex(banner => banner.id === id)
    if (index === -1) return null
    db.banners[index] = { ...db.banners[index], ...data }
    writeDB(db)
    return db.banners[index]
  }

  try {
    return serializeBanner(await prisma.banner.update({ where: { id }, data }))
  } catch (error) {
    console.error('[database] updateBanner Prisma failed, using fallback:', error)
    const db = readDB()
    const index = db.banners.findIndex(banner => banner.id === id)
    if (index === -1) return null
    db.banners[index] = { ...db.banners[index], ...data }
    writeDB(db)
    return db.banners[index]
  }
}

export async function deleteBanner(id: string) {
  if (!hasDatabase || !prisma?.banner) {
    const db = readDB()
    const index = db.banners.findIndex(banner => banner.id === id)
    if (index === -1) return false
    db.banners.splice(index, 1)
    writeDB(db)
    return true
  }

  try {
    await prisma.banner.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('[database] deleteBanner Prisma failed:', error)
    return false
  }
}

export async function listOrders() {
  if (!hasDatabase || !prisma?.order) return readDB().orders
  try {
    const orders = await prisma.order.findMany({
      include: { address: true, payment: true, items: true },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(serializeOrder)
  } catch (error) {
    console.error('[database] listOrders Prisma failed, using fallback:', error)
    return readDB().orders
  }
}

export async function getOrderByNumber(orderNumber: string) {
  if (!hasDatabase || !prisma?.order) {
    return readDB().orders.find(order => order.orderNumber === orderNumber) || null
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { address: true, payment: true, items: true },
    })
    return order ? serializeOrder(order) : null
  } catch (error) {
    console.error('[database] getOrderByNumber Prisma failed, using fallback:', error)
    return readDB().orders.find(order => order.orderNumber === orderNumber) || null
  }
}

export async function createOrder(data: Order) {
  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const newOrder: Order = { ...data, id: `order_${Date.now()}` }
    db.orders.unshift(newOrder)
    writeDB(db)
    return newOrder
  }

  try {
    const order = await prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerCpf: data.customerCpf,
        subtotal: data.subtotal,
        shippingTotal: data.shippingCost,
        total: data.total,
        status: data.status,
        paymentStatus: data.paymentStatus,
        fulfillmentStatus: data.fulfillmentStatus,
        trackingCode: data.trackingCode,
        address: {
          create: {
            zipCode: data.shippingAddress.zipCode,
            street: data.shippingAddress.street,
            number: data.shippingAddress.number,
            complement: data.shippingAddress.complement,
            neighborhood: data.shippingAddress.neighborhood,
            city: data.shippingAddress.city,
            state: data.shippingAddress.state,
          },
        },
        payment: {
          create: {
            provider: 'manual',
            method: data.paymentMethod || 'manual',
            status: data.paymentStatus,
            amount: data.total,
          },
        },
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            productNameSnapshot: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            personalizationJson: item.observation || null,
          })),
        },
      },
      include: { address: true, payment: true, items: true },
    })

    return serializeOrder(order)
  } catch (error) {
    console.error('[database] createOrder Prisma failed, using fallback:', error)
    const db = readDB()
    const newOrder: Order = { ...data, id: `order_${Date.now()}` }
    db.orders.unshift(newOrder)
    writeDB(db)
    return newOrder
  }
}

export async function updateOrder(id: string, data: Partial<Order>) {
  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const index = db.orders.findIndex(order => order.id === id)
    if (index === -1) return null
    db.orders[index] = { ...db.orders[index], ...data }
    writeDB(db)
    return db.orders[index]
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data: {
        status: data.status,
        paymentStatus: data.paymentStatus,
        fulfillmentStatus: data.fulfillmentStatus,
        trackingCode: data.trackingCode,
        subtotal: data.subtotal,
        shippingTotal: data.shippingCost,
        total: data.total,
      },
      include: { address: true, payment: true, items: true },
    })

    if (data.paymentStatus) {
      await prisma.payment.updateMany({ where: { orderId: id }, data: { status: data.paymentStatus } })
    }

    if (data.items) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } })
      await prisma.orderItem.createMany({
        data: data.items.map(item => ({
          orderId: id,
          productId: item.productId,
          productNameSnapshot: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          personalizationJson: item.observation || null,
        })),
      })
    }

    return serializeOrder(order)
  } catch (error) {
    console.error('[database] updateOrder Prisma failed, using fallback:', error)
    const db = readDB()
    const index = db.orders.findIndex(order => order.id === id)
    if (index === -1) return null
    db.orders[index] = { ...db.orders[index], ...data }
    writeDB(db)
    return db.orders[index]
  }
}

export async function updateOrderPaymentByNumber(orderNumber: string, data: {
  status: string
  paymentStatus: string
  provider: string
  method: string
  amount?: number
  providerPaymentId?: string | null
  pixQrCodeBase64?: string | null
  pixCopyPaste?: string | null
  checkoutUrl?: string | null
  rawPayload?: Record<string, unknown> | null
}) {
  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const index = db.orders.findIndex(order => order.orderNumber === orderNumber)
    if (index === -1) return null

    db.orders[index] = {
      ...db.orders[index],
      paymentStatus: data.paymentStatus,
      status: data.status,
      paymentMethod: data.method,
      paymentDetails: {
        provider: data.provider,
        providerPaymentId: data.providerPaymentId || undefined,
        method: data.method,
        status: data.paymentStatus,
        statusDetail: typeof data.rawPayload?.status_detail === 'string' ? data.rawPayload.status_detail : undefined,
        checkoutUrl: data.checkoutUrl || undefined,
        pixQrCodeBase64: data.pixQrCodeBase64 || undefined,
        pixQrCode: data.pixQrCodeBase64 || undefined,
        pixCopyPaste: data.pixCopyPaste || undefined,
      },
    }
    writeDB(db)
    return db.orders[index]
  }

  try {
    const order = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: data.status,
        paymentStatus: data.paymentStatus,
        payment: {
          upsert: {
            create: {
              provider: data.provider,
              providerPaymentId: data.providerPaymentId || null,
              method: data.method,
              status: data.paymentStatus,
              amount: data.amount || 0,
              pixQrCode: data.pixQrCodeBase64 || null,
              pixCopyPaste: data.pixCopyPaste || null,
              rawPayload: data.rawPayload as Prisma.InputJsonValue | undefined,
            },
            update: {
              provider: data.provider,
              providerPaymentId: data.providerPaymentId || null,
              method: data.method,
              status: data.paymentStatus,
              pixQrCode: data.pixQrCodeBase64 || null,
              pixCopyPaste: data.pixCopyPaste || null,
              rawPayload: data.rawPayload as Prisma.InputJsonValue | undefined,
            },
          },
        },
      },
      include: { address: true, payment: true, items: true },
    })

    if (data.rawPayload?.paidAt && order.payment?.id) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { paidAt: new Date(String(data.rawPayload.paidAt)) },
      })
    }

    return serializeOrder(await prisma.order.findUniqueOrThrow({
      where: { orderNumber },
      include: { address: true, payment: true, items: true },
    }))
  } catch (error) {
    console.error('[database] updateOrderPaymentByNumber Prisma failed:', error)
    return null
  }
}

export async function registerWebhookEvent(data: WebhookEventUpsert) {
  if (!hasDatabase || !prisma?.webhookEvent) {
    const db = readDB()
    const existing = db.webhookEvents.find(event => event.deliveryKey === data.deliveryKey)
    if (existing) {
      return { event: existing, created: false }
    }

    const now = new Date().toISOString()
    const createdEvent: WebhookEvent = {
      id: `webhook_${Date.now()}`,
      provider: data.provider,
      deliveryKey: data.deliveryKey,
      topic: data.topic,
      resourceId: data.resourceId,
      eventId: data.eventId,
      action: data.action,
      orderNumber: data.orderNumber,
      paymentId: data.paymentId,
      payloadHash: data.payloadHash,
      signature: data.signature || undefined,
      status: 'received',
      receivedAt: now,
      updatedAt: now,
    }

    db.webhookEvents.unshift(createdEvent)
    writeDB(db)
    return { event: createdEvent, created: true }
  }

  try {
    const created = await prisma.webhookEvent.create({
      data: {
        provider: data.provider,
        deliveryKey: data.deliveryKey,
        topic: data.topic,
        resourceId: data.resourceId || null,
        eventId: data.eventId || null,
        action: data.action || null,
        orderNumber: data.orderNumber || null,
        paymentId: data.paymentId || null,
        payloadHash: data.payloadHash,
        signature: data.signature || null,
      },
    })

    return { event: created, created: true }
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existing = await prisma.webhookEvent.findUnique({ where: { deliveryKey: data.deliveryKey } })
      return { event: existing, created: false }
    }

    throw error
  }
}

export async function updateWebhookEvent(deliveryKey: string, data: WebhookEventUpdate) {
  if (!hasDatabase || !prisma?.webhookEvent) {
    const db = readDB()
    const index = db.webhookEvents.findIndex(event => event.deliveryKey === deliveryKey)
    if (index === -1) return null

    db.webhookEvents[index] = {
      ...db.webhookEvents[index],
      status: data.status,
      processedAt: data.processedAt ? new Date(data.processedAt).toISOString() : db.webhookEvents[index].processedAt,
      lastError: data.lastError || undefined,
      orderNumber: data.orderNumber ?? db.webhookEvents[index].orderNumber,
      paymentId: data.paymentId ?? db.webhookEvents[index].paymentId,
      updatedAt: new Date().toISOString(),
    }

    writeDB(db)
    return db.webhookEvents[index]
  }

  return prisma.webhookEvent.update({
    where: { deliveryKey },
    data: {
      status: data.status,
      processedAt: data.processedAt ? new Date(data.processedAt) : undefined,
      lastError: data.lastError ?? undefined,
      orderNumber: data.orderNumber ?? undefined,
      paymentId: data.paymentId ?? undefined,
    },
  })
}

export async function deleteOrder(id: string) {
  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const index = db.orders.findIndex(order => order.id === id)
    if (index === -1) return false
    db.orders.splice(index, 1)
    writeDB(db)
    return true
  }

  try {
    await prisma.order.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('[database] deleteOrder Prisma failed:', error)
    return false
  }
}

// ===========================================================================
// Production control (see brief sections 5–7)
// ===========================================================================

const VALID_TASK_STATUSES: ProductionTaskStatus[] = [
  'pending',
  'in_production',
  'paused',
  'completed',
  'cancelled',
]
const VALID_PRIORITIES: ProductionPriority[] = ['low', 'normal', 'high', 'urgent']
const VALID_RISK_LEVELS: ProductionRiskLevel[] = [
  'on_track',
  'attention',
  'at_risk',
  'overdue',
  'completed',
]

const TASK_INCLUDE = {
  order: true,
  orderItem: {
    include: {
      product: true,
      variant: true,
    },
  },
} as const

function serializeSettings(record: any): ProductionSettingsRecord {
  return {
    id: record.id || 'default',
    dailyCapacityMinutes: Number(record.dailyCapacityMinutes ?? 480),
    riskBufferHours: Number(record.riskBufferHours ?? 24),
    businessDaysOnly: Boolean(record.businessDaysOnly ?? false),
    createdAt:
      record.createdAt instanceof Date
        ? record.createdAt.toISOString()
        : String(record.createdAt ?? new Date(0).toISOString()),
    updatedAt:
      record.updatedAt instanceof Date
        ? record.updatedAt.toISOString()
        : String(record.updatedAt ?? new Date(0).toISOString()),
  }
}

function settingsForDomain(record: ProductionSettingsRecord): ProductionSettingsLike {
  return {
    dailyCapacityMinutes: record.dailyCapacityMinutes,
    riskBufferHours: record.riskBufferHours,
    businessDaysOnly: record.businessDaysOnly,
  }
}

function toTaskWithRelations(task: any) {
  return {
    id: task.id,
    status: task.status,
    priority: task.priority,
    requiredQuantity: task.requiredQuantity,
    producedQuantity: task.producedQuantity,
    dueAt: task.dueAt ?? null,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    notes: task.notes ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    order: {
      id: task.order.id,
      orderNumber: task.order.orderNumber,
      customerName: task.order.customerName ?? null,
      customerEmail: task.order.customerEmail ?? null,
      fulfillmentStatus: task.order.fulfillmentStatus ?? null,
      productionDeadline: task.order.productionDeadline ?? null,
    },
    orderItem: {
      id: task.orderItem.id,
      productNameSnapshot: task.orderItem.productNameSnapshot ?? null,
      skuSnapshot: task.orderItem.skuSnapshot ?? null,
      quantity: task.orderItem.quantity,
      variantId: task.orderItem.variantId ?? null,
    },
    product: task.orderItem.product
      ? { productionMinutesPerUnit: task.orderItem.product.productionMinutesPerUnit ?? null }
      : null,
    variant: task.orderItem.variant
      ? { productionMinutesPerUnit: task.orderItem.variant.productionMinutesPerUnit ?? null }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function readSettingsRecord(): Promise<ProductionSettingsRecord> {
  if (!hasDatabase || !prisma?.productionSettings) {
    const db = readDB()
    return db.productionSettings[0] || {
      id: 'default',
      dailyCapacityMinutes: 480,
      riskBufferHours: 24,
      businessDaysOnly: false,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }
  }

  try {
    let row = await prisma.productionSettings.findUnique({ where: { id: 'default' } })
    if (!row) {
      row = await prisma.productionSettings.create({ data: { id: 'default' } })
    }
    return serializeSettings(row)
  } catch (error) {
    console.error('[database] readSettingsRecord Prisma failed, using fallback:', error)
    const db = readDB()
    return db.productionSettings[0] || {
      id: 'default',
      dailyCapacityMinutes: 480,
      riskBufferHours: 24,
      businessDaysOnly: false,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }
  }
}

export async function getProductionSettings(): Promise<ProductionSettingsDto> {
  const record = await readSettingsRecord()
  return record
}

export async function updateProductionSettings(
  input: UpdateProductionSettingsInput
): Promise<{ ok: true; settings: ProductionSettingsDto } | { ok: false; error: string }> {
  if (
    typeof input.dailyCapacityMinutes === 'number' &&
    !(Number.isFinite(input.dailyCapacityMinutes) && input.dailyCapacityMinutes > 0)
  ) {
    return { ok: false, error: 'Capacidade diária deve ser maior que zero.' }
  }
  if (
    typeof input.riskBufferHours === 'number' &&
    !(Number.isFinite(input.riskBufferHours) && input.riskBufferHours >= 0)
  ) {
    return { ok: false, error: 'Buffer de risco deve ser zero ou positivo.' }
  }

  if (!hasDatabase || !prisma?.productionSettings) {
    const db = readDB()
    const existing = db.productionSettings[0] || {
      id: 'default',
      dailyCapacityMinutes: 480,
      riskBufferHours: 24,
      businessDaysOnly: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const next: ProductionSettingsRecord = {
      ...existing,
      dailyCapacityMinutes:
        typeof input.dailyCapacityMinutes === 'number'
          ? Math.floor(input.dailyCapacityMinutes)
          : existing.dailyCapacityMinutes,
      riskBufferHours:
        typeof input.riskBufferHours === 'number'
          ? Math.floor(input.riskBufferHours)
          : existing.riskBufferHours,
      businessDaysOnly:
        typeof input.businessDaysOnly === 'boolean'
          ? input.businessDaysOnly
          : existing.businessDaysOnly,
      updatedAt: new Date().toISOString(),
    }
    db.productionSettings = [next]
    writeDB(db)
    return { ok: true, settings: next }
  }

  try {
    const row = await prisma.productionSettings.upsert({
      where: { id: 'default' },
      update: {
        dailyCapacityMinutes:
          typeof input.dailyCapacityMinutes === 'number'
            ? Math.floor(input.dailyCapacityMinutes)
            : undefined,
        riskBufferHours:
          typeof input.riskBufferHours === 'number'
            ? Math.floor(input.riskBufferHours)
            : undefined,
        businessDaysOnly:
          typeof input.businessDaysOnly === 'boolean' ? input.businessDaysOnly : undefined,
      },
      create: {
        id: 'default',
        dailyCapacityMinutes:
          typeof input.dailyCapacityMinutes === 'number'
            ? Math.floor(input.dailyCapacityMinutes)
            : 480,
        riskBufferHours:
          typeof input.riskBufferHours === 'number' ? Math.floor(input.riskBufferHours) : 24,
        businessDaysOnly:
          typeof input.businessDaysOnly === 'boolean' ? input.businessDaysOnly : false,
      },
    })
    return { ok: true, settings: serializeSettings(row) }
  } catch (error) {
    console.error('[database] updateProductionSettings Prisma failed:', error)
    return { ok: false, error: 'Erro ao salvar configurações de produção.' }
  }
}

// ---------------------------------------------------------------------------
// Listing & detail
// ---------------------------------------------------------------------------

export interface ListProductionTasksResult {
  items: SerializedProductionTaskAdmin[]
  summary: ProductionTaskSummary
  pagination: ProductionPagination
}

function emptySummary(): ProductionTaskSummary {
  return {
    totalOpen: 0,
    pending: 0,
    inProduction: 0,
    paused: 0,
    atRisk: 0,
    overdue: 0,
    completedToday: 0,
  }
}

function startOfTodayIso(now: Date): Date {
  const d = new Date(now.getTime())
  d.setHours(0, 0, 0, 0)
  return d
}

export async function listProductionTasks(
  filters: ProductionTaskFilters = {}
): Promise<ListProductionTasksResult> {
  const limit = Math.min(Math.max(filters.limit || 20, 1), 50)
  const offset = Math.max(filters.offset || 0, 0)
  const now = new Date()
  const settings = await readSettingsRecord()

  const status = filters.status && VALID_TASK_STATUSES.includes(filters.status as ProductionTaskStatus)
    ? (filters.status as ProductionTaskStatus)
    : undefined
  const priority = filters.priority && VALID_PRIORITIES.includes(filters.priority as ProductionPriority)
    ? (filters.priority as ProductionPriority)
    : undefined
  const risk = filters.risk && VALID_RISK_LEVELS.includes(filters.risk as ProductionRiskLevel)
    ? (filters.risk as ProductionRiskLevel)
    : undefined
  const q = (filters.q || '').trim()

  if (!hasDatabase || !prisma?.productionTask) {
    const db = readDB()
    const all = db.productionTasks
    // Hydrate relations from local DB (best-effort: orders/items are stored
    // inline in localDb's Order; production fallback is intentionally simple).
    const hydrated = all.map((t) => {
      const order = db.orders.find((o) => o.id === t.orderId)
      const item = order?.items.find((it: any) => it.id === t.orderItemId) as any
      const product = item ? db.products.find((p) => p.id === item.productId) : null
      const taskRel = {
        id: t.id,
        status: t.status,
        priority: t.priority,
        requiredQuantity: t.requiredQuantity,
        producedQuantity: t.producedQuantity,
        dueAt: t.dueAt ?? null,
        startedAt: t.startedAt ?? null,
        completedAt: t.completedAt ?? null,
        notes: t.notes ?? null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        order: {
          id: order?.id || t.orderId,
          orderNumber: order?.orderNumber || '',
          customerName: order?.customerName || null,
          customerEmail: order?.customerEmail || null,
          fulfillmentStatus: order?.fulfillmentStatus || null,
          productionDeadline: null,
        },
        orderItem: {
          id: item?.id || t.orderItemId,
          productNameSnapshot: item?.productName || null,
          skuSnapshot: null,
          quantity: item?.quantity ?? t.requiredQuantity,
          variantId: null,
        },
        product: product
          ? { productionMinutesPerUnit: (product as any).productionMinutesPerUnit ?? null }
          : null,
        variant: null,
      }
      return serializeProductionTask(taskRel as any, { settings: settingsForDomain(settings), now })
    })

    let filtered = hydrated
    if (status) filtered = filtered.filter((i) => i.status === status)
    if (priority) filtered = filtered.filter((i) => i.priority === priority)
    if (risk) filtered = filtered.filter((i) => i.risk.level === risk)
    if (q) {
      const lower = q.toLowerCase()
      filtered = filtered.filter((i) =>
        i.order.orderNumber.toLowerCase().includes(lower) ||
        (i.order.customerName || '').toLowerCase().includes(lower) ||
        (i.order.customerEmail || '').toLowerCase().includes(lower) ||
        (i.item.productNameSnapshot || '').toLowerCase().includes(lower) ||
        (i.item.skuSnapshot || '').toLowerCase().includes(lower)
      )
    }

    const summary = emptySummary()
    const todayStart = startOfTodayIso(now).getTime()
    for (const i of hydrated) {
      if (i.status !== 'completed' && i.status !== 'cancelled') summary.totalOpen += 1
      if (i.status === 'pending') summary.pending += 1
      if (i.status === 'in_production') summary.inProduction += 1
      if (i.status === 'paused') summary.paused += 1
      if (i.risk.level === 'at_risk') summary.atRisk += 1
      if (i.risk.level === 'overdue') summary.overdue += 1
      if (i.status === 'completed' && i.completedAt) {
        const t = new Date(i.completedAt).getTime()
        if (Number.isFinite(t) && t >= todayStart) summary.completedToday += 1
      }
    }

    return {
      items: filtered.slice(offset, offset + limit),
      summary,
      pagination: { limit, offset, total: filtered.length },
    }
  }

  try {
    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (q) {
      where.OR = [
        { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
        { order: { customerName: { contains: q, mode: 'insensitive' } } },
        { order: { customerEmail: { contains: q, mode: 'insensitive' } } },
        { orderItem: { productNameSnapshot: { contains: q, mode: 'insensitive' } } },
        { orderItem: { skuSnapshot: { contains: q, mode: 'insensitive' } } },
      ]
    }

    // Risk is computed in memory (no column), so when a risk filter is set we
    // must page over the *filtered* set. We fetch the whole `where` set first
    // (capped reasonably), serialize, then filter and slice. Without a risk
    // filter we use SQL pagination to keep things efficient.
    if (risk) {
      const all = await prisma.productionTask.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
        take: 500,
      })
      const serialized = all.map((t) =>
        serializeProductionTask(toTaskWithRelations(t), {
          settings: settingsForDomain(settings),
          now,
        })
      )
      const filtered = serialized.filter((i) => i.risk.level === risk)
      const summary = await computeSummary(now)
      return {
        items: filtered.slice(offset, offset + limit),
        summary,
        pagination: { limit, offset, total: filtered.length },
      }
    }

    const [tasks, total] = await Promise.all([
      prisma.productionTask.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        skip: offset,
      }),
      prisma.productionTask.count({ where }),
    ])

    const items = tasks.map((t) =>
      serializeProductionTask(toTaskWithRelations(t), {
        settings: settingsForDomain(settings),
        now,
      })
    )
    const summary = await computeSummary(now)
    return { items, summary, pagination: { limit, offset, total } }
  } catch (error) {
    console.error('[database] listProductionTasks Prisma failed, using fallback:', error)
    return {
      items: [],
      summary: emptySummary(),
      pagination: { limit, offset, total: 0 },
    }
  }
}

async function computeSummary(now: Date): Promise<ProductionTaskSummary> {
  const summary = emptySummary()
  if (!hasDatabase || !prisma?.productionTask) return summary

  try {
    const todayStart = startOfTodayIso(now)
    const settings = await readSettingsRecord()
    const [pending, inProduction, paused, completedToday, openTasks] = await Promise.all([
      prisma.productionTask.count({ where: { status: 'pending' } }),
      prisma.productionTask.count({ where: { status: 'in_production' } }),
      prisma.productionTask.count({ where: { status: 'paused' } }),
      prisma.productionTask.count({
        where: { status: 'completed', completedAt: { gte: todayStart } },
      }),
      prisma.productionTask.findMany({
        where: { status: { in: ['pending', 'in_production', 'paused'] } },
        include: TASK_INCLUDE,
        take: 500,
      }),
    ])

    summary.pending = pending
    summary.inProduction = inProduction
    summary.paused = paused
    summary.completedToday = completedToday
    summary.totalOpen = pending + inProduction + paused

    for (const t of openTasks) {
      const minutesPerUnit = getProductionUnitMinutes({
        product: t.orderItem.product,
        variant: t.orderItem.variant,
      })
      const risk = calculateProductionRisk({
        requiredQuantity: t.requiredQuantity,
        producedQuantity: t.producedQuantity,
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        dueAt: t.dueAt,
        productionMinutesPerUnit: minutesPerUnit,
        settings: settingsForDomain(settings),
        now,
        status: (t.status as ProductionTaskStatus) || 'pending',
      })
      if (risk.level === 'at_risk') summary.atRisk += 1
      if (risk.level === 'overdue') summary.overdue += 1
    }

    return summary
  } catch (error) {
    console.error('[database] computeSummary Prisma failed:', error)
    return summary
  }
}

export async function getProductionTask(
  id: string
): Promise<(SerializedProductionTaskAdmin & { logs?: ProductionLogEntry[] }) | null> {
  if (!id) return null
  const settings = await readSettingsRecord()
  const now = new Date()

  if (!hasDatabase || !prisma?.productionTask) {
    const db = readDB()
    const t = db.productionTasks.find((x) => x.id === id)
    if (!t) return null
    const order = db.orders.find((o) => o.id === t.orderId)
    const item = order?.items.find((it: any) => it.id === t.orderItemId) as any
    const product = item ? db.products.find((p) => p.id === item.productId) : null
    const rel = {
      id: t.id,
      status: t.status,
      priority: t.priority,
      requiredQuantity: t.requiredQuantity,
      producedQuantity: t.producedQuantity,
      dueAt: t.dueAt ?? null,
      startedAt: t.startedAt ?? null,
      completedAt: t.completedAt ?? null,
      notes: t.notes ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      order: {
        id: order?.id || t.orderId,
        orderNumber: order?.orderNumber || '',
        customerName: order?.customerName || null,
        customerEmail: order?.customerEmail || null,
        fulfillmentStatus: order?.fulfillmentStatus || null,
        productionDeadline: null,
      },
      orderItem: {
        id: item?.id || t.orderItemId,
        productNameSnapshot: item?.productName || null,
        skuSnapshot: null,
        quantity: item?.quantity ?? t.requiredQuantity,
        variantId: null,
      },
      product: product
        ? { productionMinutesPerUnit: (product as any).productionMinutesPerUnit ?? null }
        : null,
      variant: null,
    }
    const serialized = serializeProductionTask(rel as any, {
      settings: settingsForDomain(settings),
      now,
    })
    const logs: ProductionLogEntry[] = db.productionLogs
      .filter((l) => l.taskId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((l) => ({
        id: l.id,
        quantityDelta: l.quantityDelta,
        quantityAfter: l.quantityAfter,
        statusBefore: l.statusBefore ?? null,
        statusAfter: l.statusAfter ?? null,
        note: l.note ?? null,
        createdByEmail: l.createdByEmail ?? null,
        createdByName: l.createdByName ?? null,
        createdAt: l.createdAt,
      }))
    return { ...serialized, logs }
  }

  try {
    const task = await prisma.productionTask.findUnique({
      where: { id },
      include: {
        ...TASK_INCLUDE,
        logs: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!task) return null
    const serialized = serializeProductionTask(toTaskWithRelations(task), {
      settings: settingsForDomain(settings),
      now,
    })
    const logs: ProductionLogEntry[] = (task as any).logs.map((l: any) => ({
      id: l.id,
      quantityDelta: l.quantityDelta,
      quantityAfter: l.quantityAfter,
      statusBefore: l.statusBefore ?? null,
      statusAfter: l.statusAfter ?? null,
      note: l.note ?? null,
      createdByEmail: l.createdByEmail ?? null,
      createdByName: l.createdByName ?? null,
      createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
    }))
    return { ...serialized, logs }
  } catch (error) {
    console.error('[database] getProductionTask Prisma failed:', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Update task
// ---------------------------------------------------------------------------

export type UpdateProductionTaskResult =
  | { ok: true; task: SerializedProductionTaskAdmin }
  | { ok: false; error: string }

export async function updateProductionTask(
  id: string,
  input: UpdateProductionTaskInput,
  actor: UpdateProductionTaskActor = {}
): Promise<UpdateProductionTaskResult> {
  if (!id) return { ok: false, error: 'ID da tarefa é obrigatório.' }

  // Validate status/priority shape early.
  if (
    typeof input.status === 'string' &&
    !VALID_TASK_STATUSES.includes(input.status as ProductionTaskStatus)
  ) {
    return { ok: false, error: `Status inválido: ${input.status}` }
  }
  if (
    typeof input.priority === 'string' &&
    !VALID_PRIORITIES.includes(input.priority as ProductionPriority)
  ) {
    return { ok: false, error: `Prioridade inválida: ${input.priority}` }
  }

  const settings = await readSettingsRecord()
  const now = new Date()

  // ---- Fallback path (localDb) ----
  if (!hasDatabase || !prisma?.productionTask) {
    const db = readDB()
    const idx = db.productionTasks.findIndex((t) => t.id === id)
    if (idx === -1) return { ok: false, error: 'Tarefa não encontrada.' }
    const current = db.productionTasks[idx]

    const computed = computeQuantityAndStatus(current, input)
    if (!computed.ok) return computed

    const updated: ProductionTaskRecord = {
      ...current,
      producedQuantity: computed.nextQuantity,
      status: computed.nextStatus,
      startedAt:
        computed.startedAt instanceof Date
          ? computed.startedAt.toISOString()
          : computed.startedAt ?? current.startedAt ?? null,
      completedAt:
        computed.completedAt === null
          ? null
          : computed.completedAt instanceof Date
            ? computed.completedAt.toISOString()
            : computed.completedAt ?? current.completedAt ?? null,
      priority:
        typeof input.priority === 'string'
          ? (input.priority as ProductionPriority)
          : current.priority,
      dueAt:
        input.dueAt === null
          ? null
          : typeof input.dueAt === 'string'
            ? input.dueAt
            : current.dueAt ?? null,
      notes:
        input.notes === null
          ? null
          : typeof input.notes === 'string'
            ? input.notes
            : current.notes ?? null,
      updatedAt: new Date().toISOString(),
    }

    db.productionTasks[idx] = updated
    db.productionLogs.unshift({
      id: `plog_${Date.now()}`,
      taskId: id,
      quantityDelta: computed.delta,
      quantityAfter: computed.nextQuantity,
      statusBefore: current.status,
      statusAfter: computed.nextStatus,
      note: input.note || null,
      createdByEmail: actor.email || null,
      createdByName: actor.name || null,
      createdAt: new Date().toISOString(),
    })
    writeDB(db)

    await refreshOrderFulfillmentFromProduction(updated.orderId)

    const serialized = await getProductionTask(id)
    if (!serialized) return { ok: false, error: 'Falha ao reler tarefa após atualização.' }
    return { ok: true, task: serialized }
  }

  // ---- Prisma path with transaction ----
  let orderIdForRefresh: string | null = null
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.productionTask.findUnique({ where: { id } })
      if (!current) return { ok: false as const, error: 'Tarefa não encontrada.' }

      const computed = computeQuantityAndStatus(
        {
          producedQuantity: current.producedQuantity,
          requiredQuantity: current.requiredQuantity,
          status: current.status,
          startedAt: current.startedAt ? current.startedAt.toISOString() : null,
          completedAt: current.completedAt ? current.completedAt.toISOString() : null,
        },
        input
      )
      if (!computed.ok) return computed

      const updateData: any = {
        producedQuantity: computed.nextQuantity,
        status: computed.nextStatus,
        priority:
          typeof input.priority === 'string'
            ? (input.priority as ProductionPriority)
            : undefined,
      }
      if (computed.startedAt instanceof Date) updateData.startedAt = computed.startedAt
      if (computed.completedAt === null) {
        updateData.completedAt = null
      } else if (computed.completedAt instanceof Date) {
        updateData.completedAt = computed.completedAt
      }
      if (input.dueAt === null) {
        updateData.dueAt = null
      } else if (typeof input.dueAt === 'string') {
        const d = new Date(input.dueAt)
        if (Number.isFinite(d.getTime())) updateData.dueAt = d
      }
      if (input.notes === null) updateData.notes = null
      else if (typeof input.notes === 'string') updateData.notes = input.notes

      const updated = await tx.productionTask.update({ where: { id }, data: updateData })

      await tx.productionLog.create({
        data: {
          taskId: id,
          quantityDelta: computed.delta,
          quantityAfter: computed.nextQuantity,
          statusBefore: current.status,
          statusAfter: computed.nextStatus,
          note: input.note || null,
          createdByEmail: actor.email || null,
          createdByName: actor.name || null,
        },
      })

      orderIdForRefresh = updated.orderId
      return { ok: true as const }
    })

    if (!result.ok) return { ok: false, error: result.error }

    if (orderIdForRefresh) {
      await refreshOrderFulfillmentFromProduction(orderIdForRefresh)
    }

    const refreshed = await getProductionTask(id)
    if (!refreshed) return { ok: false, error: 'Tarefa não encontrada após atualização.' }
    return { ok: true, task: refreshed }
  } catch (error) {
    console.error('[database] updateProductionTask Prisma failed:', error)
    return { ok: false, error: 'Erro ao atualizar tarefa de produção.' }
  }
}

interface QuantityStatusInput {
  producedQuantity: number
  requiredQuantity: number
  status: string
  startedAt?: string | Date | null
  completedAt?: string | Date | null
}

interface QuantityStatusOk {
  ok: true
  nextQuantity: number
  delta: number
  nextStatus: ProductionTaskStatus
  startedAt?: Date | string | null
  completedAt?: Date | null
}

function computeQuantityAndStatus(
  current: QuantityStatusInput,
  input: UpdateProductionTaskInput
): QuantityStatusOk | { ok: false; error: string } {
  const required = Math.max(0, Math.floor(current.requiredQuantity))
  const currentProduced = Math.max(0, Math.floor(current.producedQuantity))

  let nextQuantity = currentProduced
  if (typeof input.producedQuantity === 'number' && Number.isFinite(input.producedQuantity)) {
    nextQuantity = Math.floor(input.producedQuantity)
  } else if (typeof input.quantityDelta === 'number' && Number.isFinite(input.quantityDelta)) {
    nextQuantity = currentProduced + Math.floor(input.quantityDelta)
  }

  if (nextQuantity < 0) {
    return { ok: false, error: 'Quantidade produzida não pode ser negativa.' }
  }
  if (nextQuantity > required) {
    return {
      ok: false,
      error: `Quantidade produzida (${nextQuantity}) excede o necessário (${required}).`,
    }
  }

  const delta = nextQuantity - currentProduced

  // Determine next status.
  const currentStatus = (current.status as ProductionTaskStatus) || 'pending'
  let nextStatus: ProductionTaskStatus = currentStatus

  // Auto transition rules
  if (currentProduced === 0 && nextQuantity > 0 && currentStatus === 'pending') {
    nextStatus = 'in_production'
  }
  if (required > 0 && nextQuantity >= required) {
    nextStatus = 'completed'
  }
  // Correction back from completed
  let resetCompletedAt: Date | null | undefined = undefined
  if (nextQuantity < required && currentStatus === 'completed') {
    nextStatus = 'in_production'
    resetCompletedAt = null
  }

  // Explicit status override (last word, if valid)
  if (
    typeof input.status === 'string' &&
    VALID_TASK_STATUSES.includes(input.status as ProductionTaskStatus)
  ) {
    nextStatus = input.status as ProductionTaskStatus
  }

  // startedAt / completedAt
  let startedAt: Date | undefined
  if (
    nextStatus !== 'pending' &&
    !current.startedAt &&
    (nextQuantity > 0 || nextStatus === 'in_production' || nextStatus === 'paused')
  ) {
    startedAt = new Date()
  }
  let completedAt: Date | null | undefined = resetCompletedAt
  if (nextStatus === 'completed' && !current.completedAt) {
    completedAt = new Date()
  }

  return {
    ok: true,
    nextQuantity,
    delta,
    nextStatus,
    startedAt,
    completedAt,
  }
}

// ---------------------------------------------------------------------------
// Ensure & sync
// ---------------------------------------------------------------------------

export interface EnsureProductionResult {
  created: number
  skipped?: string
}

export async function ensureProductionTasksForOrder(
  orderId: string
): Promise<EnsureProductionResult> {
  if (!orderId) return { created: 0, skipped: 'invalid_order_id' }

  if (!hasDatabase || !prisma?.order || !prisma?.productionTask) {
    const db = readDB()
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) return { created: 0, skipped: 'order_not_found' }
    if (order.status !== 'paid') return { created: 0, skipped: 'order_not_paid' }

    let created = 0
    for (const item of (order.items as any[]) || []) {
      const itemId = item.id || `${order.id}_${item.productId}`
      if (db.productionTasks.some((t) => t.orderItemId === itemId)) continue
      const product = db.products.find((p) => p.id === item.productId)
      if (!product) continue
      const eligible = product.underOrder === true || product.isPersonalizable === true
      if (!eligible) continue

      const dueAt = computeFallbackDueAt(product as any, null)
      const priority = isUrgent(dueAt) ? 'urgent' : 'normal'

      db.productionTasks.unshift({
        id: `ptask_${Date.now()}_${created}`,
        orderId: order.id,
        orderItemId: itemId,
        requiredQuantity: Math.max(1, Math.floor(item.quantity ?? 1)),
        producedQuantity: 0,
        status: 'pending',
        priority,
        dueAt: dueAt.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      created += 1
    }
    if (created > 0) writeDB(db)
    return { created }
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    })
    if (!order) return { created: 0, skipped: 'order_not_found' }
    if (order.status !== 'paid') return { created: 0, skipped: 'order_not_paid' }

    let created = 0
    for (const item of order.items) {
      const eligible =
        Boolean(item.product?.underOrder) || Boolean(item.product?.isPersonalizable)
      if (!eligible) continue

      const exists = await prisma.productionTask.findUnique({
        where: { orderItemId: item.id },
      })
      if (exists) continue

      const dueAt =
        order.productionDeadline ||
        new Date(
          Date.now() +
            Math.max(1, Number(item.product?.productionTimeMaxDays ?? 3)) *
              24 *
              60 *
              60 *
              1000
        )

      const priority = isUrgent(dueAt) ? 'urgent' : 'normal'

      try {
        await prisma.productionTask.create({
          data: {
            orderId: order.id,
            orderItemId: item.id,
            requiredQuantity: Math.max(1, Math.floor(item.quantity)),
            producedQuantity: 0,
            status: 'pending',
            priority,
            dueAt,
          },
        })
        created += 1
      } catch (err: any) {
        // Idempotent: ignore unique violation on orderItemId
        if (err?.code !== 'P2002') {
          console.error('[database] ensureProductionTasksForOrder create failed:', err)
        }
      }
    }

    return { created }
  } catch (error) {
    console.error('[database] ensureProductionTasksForOrder Prisma failed:', error)
    return { created: 0, skipped: 'error' }
  }
}

function computeFallbackDueAt(
  product: { productionTimeMaxDays?: number | null } | null,
  productionDeadline: Date | string | null
): Date {
  if (productionDeadline) {
    const d = new Date(productionDeadline)
    if (Number.isFinite(d.getTime())) return d
  }
  const days = Math.max(1, Number(product?.productionTimeMaxDays ?? 3))
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function isUrgent(dueAt: Date): boolean {
  return dueAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000
}

export interface SyncProductionResult {
  created: number
  skipped: number
  ordersScanned: number
}

export async function syncProductionTasksForPaidOrders(input?: {
  orderNumber?: string
}): Promise<SyncProductionResult> {
  const orderNumber = input?.orderNumber

  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const candidates = orderNumber
      ? db.orders.filter((o) => o.orderNumber === orderNumber)
      : db.orders.filter(
          (o) =>
            o.status === 'paid' &&
            (o.fulfillmentStatus === 'pending' || o.fulfillmentStatus === 'in_production')
        )

    let created = 0
    let skipped = 0
    for (const o of candidates) {
      const before = readDB().productionTasks.length
      const r = await ensureProductionTasksForOrder(o.id)
      created += r.created
      const after = readDB().productionTasks.length
      const itemCount = (o.items || []).length
      skipped += Math.max(0, itemCount - (after - before))
    }
    return { created, skipped, ordersScanned: candidates.length }
  }

  try {
    let candidates: { id: string }[]
    if (orderNumber) {
      const o = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true },
      })
      candidates = o ? [o] : []
    } else {
      candidates = await prisma.order.findMany({
        where: {
          status: 'paid',
          fulfillmentStatus: { in: ['pending', 'in_production'] },
        },
        select: { id: true },
      })
    }

    let created = 0
    let skipped = 0
    for (const c of candidates) {
      const result = await ensureProductionTasksForOrder(c.id)
      created += result.created
      // Approximate skipped count — items that already had a task or were ineligible.
      const itemCount = await prisma.orderItem.count({ where: { orderId: c.id } })
      skipped += Math.max(0, itemCount - result.created)
    }

    return { created, skipped, ordersScanned: candidates.length }
  } catch (error) {
    console.error('[database] syncProductionTasksForPaidOrders Prisma failed:', error)
    return { created: 0, skipped: 0, ordersScanned: 0 }
  }
}

// ---------------------------------------------------------------------------
// Customer view
// ---------------------------------------------------------------------------

export async function getCustomerOrderProduction(
  user: { email: string },
  orderNumber: string
): Promise<SerializedCustomerProduction | null> {
  if (!user?.email || !orderNumber) return null
  const normalizedEmail = user.email.toLowerCase()

  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const order = db.orders.find((o) => o.orderNumber === orderNumber)
    if (!order) return null
    if ((order.customerEmail || '').toLowerCase() !== normalizedEmail) return null

    const tasks = db.productionTasks.filter((t) => t.orderId === order.id)
    if (tasks.length === 0) {
      return { orderNumber, hasProduction: false, overall: null, items: [] }
    }
    const inputs = tasks.map((t) => {
      const item = order.items.find((it: any) => it.id === t.orderItemId) as any
      return {
        status: t.status,
        requiredQuantity: t.requiredQuantity,
        producedQuantity: t.producedQuantity,
        updatedAt: t.updatedAt,
        orderItem: { productNameSnapshot: item?.productName ?? null },
      }
    })
    return serializeCustomerProduction(inputs, orderNumber)
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        productionTasks: {
          include: { orderItem: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!order) return null
    if ((order.customerEmail || '').toLowerCase() !== normalizedEmail) return null

    if (!order.productionTasks || order.productionTasks.length === 0) {
      return { orderNumber, hasProduction: false, overall: null, items: [] }
    }

    const inputs = order.productionTasks.map((t: any) => ({
      status: t.status,
      requiredQuantity: t.requiredQuantity,
      producedQuantity: t.producedQuantity,
      updatedAt: t.updatedAt,
      orderItem: { productNameSnapshot: t.orderItem?.productNameSnapshot ?? null },
    }))
    return serializeCustomerProduction(inputs, orderNumber)
  } catch (error) {
    console.error('[database] getCustomerOrderProduction Prisma failed:', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Refresh order fulfillment
// ---------------------------------------------------------------------------

export async function refreshOrderFulfillmentFromProduction(
  orderId: string
): Promise<void> {
  if (!orderId) return

  if (!hasDatabase || !prisma?.order || !prisma?.productionTask) {
    const db = readDB()
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) return
    if (order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered') return

    const tasks = db.productionTasks.filter((t) => t.orderId === orderId)
    if (tasks.length === 0) return

    const next = computeFulfillmentFromTasks(tasks.map((t) => t.status))
    if (next && next !== order.fulfillmentStatus) {
      order.fulfillmentStatus = next
      writeDB(db)
    }
    return
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { fulfillmentStatus: true },
    })
    if (!order) return
    if (order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered') return

    const tasks = await prisma.productionTask.findMany({
      where: { orderId },
      select: { status: true },
    })
    if (tasks.length === 0) return

    const next = computeFulfillmentFromTasks(tasks.map((t) => t.status))
    if (next && next !== order.fulfillmentStatus) {
      await prisma.order.update({
        where: { id: orderId },
        data: { fulfillmentStatus: next },
      })
    }
  } catch (error) {
    console.error('[database] refreshOrderFulfillmentFromProduction Prisma failed:', error)
  }
}

function computeFulfillmentFromTasks(statuses: string[]): string | null {
  if (statuses.length === 0) return null
  // Ignore cancelled tasks for aggregation; if all cancelled, leave alone.
  const active = statuses.filter((s) => s !== 'cancelled')
  if (active.length === 0) return null
  if (active.every((s) => s === 'completed')) return 'ready_to_ship'
  if (active.some((s) => s === 'in_production' || s === 'paused')) return 'in_production'
  if (active.every((s) => s === 'pending')) return 'pending'
  return 'in_production'
}
