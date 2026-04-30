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
  if (!hasDatabase) return readDB().products

  const products = await prisma.product.findMany({
    include: { category: true, images: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
  })

  return products.map(serializeProduct)
}

export async function createProduct(data: Product) {
  if (!hasDatabase) {
    const db = readDB()
    const newProduct: Product = { ...data, id: `prod_${Date.now()}` }
    db.products.push(newProduct)
    writeDB(db)
    return newProduct
  }

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
}

export async function updateProduct(id: string, data: Partial<Product>) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.products.findIndex(product => product.id === id)
    if (index === -1) return null
    db.products[index] = { ...db.products[index], ...data }
    writeDB(db)
    return db.products[index]
  }

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
}

export async function deleteProduct(id: string) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.products.findIndex(product => product.id === id)
    if (index === -1) return false
    db.products.splice(index, 1)
    writeDB(db)
    return true
  }

  await prisma.product.delete({ where: { id } })
  return true
}

export async function listCategories() {
  if (!hasDatabase) return readDB().categories
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return categories.map(serializeCategory)
}

export async function createCategory(data: Category) {
  if (!hasDatabase) {
    const db = readDB()
    const newCategory: Category = { ...data, id: `cat_${Date.now()}` }
    db.categories.push(newCategory)
    writeDB(db)
    return newCategory
  }

  return serializeCategory(await prisma.category.create({ data }))
}

export async function updateCategory(id: string, data: Partial<Category>) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.categories.findIndex(category => category.id === id)
    if (index === -1) return null
    db.categories[index] = { ...db.categories[index], ...data }
    writeDB(db)
    return db.categories[index]
  }

  return serializeCategory(await prisma.category.update({ where: { id }, data }))
}

export async function deleteCategory(id: string) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.categories.findIndex(category => category.id === id)
    if (index === -1) return false
    db.categories.splice(index, 1)
    writeDB(db)
    return true
  }

  await prisma.category.delete({ where: { id } })
  return true
}

export async function listCustomers(q = '') {
  if (!hasDatabase) {
    const users = readDB().users
    if (!q) return users
    const lower = q.toLowerCase()
    return users.filter(user =>
      user.name.toLowerCase().includes(lower) ||
      user.email.toLowerCase().includes(lower) ||
      (user.phone && user.phone.includes(lower))
    )
  }

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
}

export async function createCustomer(data: Pick<User, 'name' | 'email' | 'phone'>) {
  if (!hasDatabase) {
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

  return serializeCustomer(await prisma.customer.create({ data }))
}

export async function updateCustomer(id: string, data: Partial<User>) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.users.findIndex(user => user.id === id)
    if (index === -1) return null
    db.users[index] = { ...db.users[index], ...data, updatedAt: new Date().toISOString() }
    writeDB(db)
    return db.users[index]
  }

  return serializeCustomer(await prisma.customer.update({
    where: { id },
    data: { name: data.name, email: data.email, phone: data.phone },
  }))
}

export async function listBanners() {
  if (!hasDatabase) return readDB().banners
  const banners = await prisma.banner.findMany({ orderBy: { createdAt: 'desc' } })
  return banners.map(serializeBanner)
}

export async function createBanner(data: Banner) {
  if (!hasDatabase) {
    const db = readDB()
    const newBanner: Banner = { ...data, id: `banner_${Date.now()}` }
    db.banners.push(newBanner)
    writeDB(db)
    return newBanner
  }

  return serializeBanner(await prisma.banner.create({ data }))
}

export async function updateBanner(id: string, data: Partial<Banner>) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.banners.findIndex(banner => banner.id === id)
    if (index === -1) return null
    db.banners[index] = { ...db.banners[index], ...data }
    writeDB(db)
    return db.banners[index]
  }

  return serializeBanner(await prisma.banner.update({ where: { id }, data }))
}

export async function deleteBanner(id: string) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.banners.findIndex(banner => banner.id === id)
    if (index === -1) return false
    db.banners.splice(index, 1)
    writeDB(db)
    return true
  }

  await prisma.banner.delete({ where: { id } })
  return true
}

export async function listOrders() {
  if (!hasDatabase) return readDB().orders
  const orders = await prisma.order.findMany({
    include: { address: true, payment: true, items: true },
    orderBy: { createdAt: 'desc' },
  })
  return orders.map(serializeOrder)
}

export async function createOrder(data: Order) {
  if (!hasDatabase) {
    const db = readDB()
    const newOrder: Order = { ...data, id: `order_${Date.now()}` }
    db.orders.unshift(newOrder)
    writeDB(db)
    return newOrder
  }

  const order = await prisma.order.create({
    data: {
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
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
}

export async function updateOrder(id: string, data: Partial<Order>) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.orders.findIndex(order => order.id === id)
    if (index === -1) return null
    db.orders[index] = { ...db.orders[index], ...data }
    writeDB(db)
    return db.orders[index]
  }

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
}

export async function deleteOrder(id: string) {
  if (!hasDatabase) {
    const db = readDB()
    const index = db.orders.findIndex(order => order.id === id)
    if (index === -1) return false
    db.orders.splice(index, 1)
    writeDB(db)
    return true
  }

  await prisma.order.delete({ where: { id } })
  return true
}
