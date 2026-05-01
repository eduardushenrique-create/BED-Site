/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma'
import { readDB, writeDB, Product, Category, Order, Banner, User } from '@/lib/localDb'

const databaseUrl = process.env.DATABASE_URL || ''
export const hasDatabase = Boolean(databaseUrl && !databaseUrl.includes('johndoe:randompassword'))

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
    isVerified: customer.isVerified,
    createdAt: customer.createdAt instanceof Date ? customer.createdAt.toISOString() : customer.createdAt,
    updatedAt: customer.updatedAt instanceof Date ? customer.updatedAt.toISOString() : customer.updatedAt,
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
      await prisma.productImage.deleteMany({ where: { productId: id } })
      if (data.imageUrl) {
        await prisma.productImage.create({ data: { productId: id, url: data.imageUrl, alt: product.name, isMain: true } })
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
      data: { name: data.name, email: data.email, phone: data.phone },
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
              rawPayload: data.rawPayload || undefined,
            },
            update: {
              provider: data.provider,
              providerPaymentId: data.providerPaymentId || null,
              method: data.method,
              status: data.paymentStatus,
              pixQrCode: data.pixQrCodeBase64 || null,
              pixCopyPaste: data.pixCopyPaste || null,
              rawPayload: data.rawPayload || undefined,
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
