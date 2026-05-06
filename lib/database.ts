/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client'
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
  CouponRecord,
  ProductVariantRecord,
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
import { getStorage } from '@/lib/storage'
import { extractContentType, isDataUrl } from '@/lib/storage/data-url'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'
import { applyProductionConsumption } from '@/lib/components-stock'
import {
  checkOrderShortages,
  fireLowStockAlertInBackground,
  fireOrderShortageAlertInBackground,
} from '@/lib/stock-alerts'
import {
  withTimelineStamp,
  type ProductionTimeline,
} from '@/lib/order-statuses'

const log = createLogger({ component: 'database' })

/**
 * Encapsula a dupla "Sentry + logger estruturado" pra cada erro pego em
 * fallback do Prisma. Substitui o antigo `console.error('[database] X:', e)`
 * que já estava espalhado pelo arquivo.
 */
function reportDbError(detail: string, error: unknown) {
  captureException(error, { context: 'database', detail })
  log.error({ err: error }, detail)
}

/**
 * Helper: se `value` for uma data URL, faz upload via storage adapter (R2 ou
 * inline) e devolve `{ url, storageKey }`. Se já for uma URL pública (https://)
 * ou string vazia/undefined, devolve sem tocar no storage.
 */
async function persistImageIfDataUrl(
  value: string | null | undefined,
  prefix: string
): Promise<{ url: string; storageKey: string | null }> {
  if (!value) return { url: '', storageKey: null }
  if (!isDataUrl(value)) return { url: value, storageKey: null }

  const contentType = extractContentType(value, 'image/jpeg')
  try {
    const result = await getStorage().upload({ data: value, contentType, prefix })
    return { url: result.url, storageKey: result.storageKey }
  } catch (error) {
    reportDbError('storage upload failed, mantendo data URL inline', error)
    return { url: value, storageKey: null }
  }
}

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

function serializeProduct(product: any): Product & {
  visibility: 'public' | 'internal'
  variants: Array<{
    id: string
    name: string
    sku: string | null
    color: string | null
    size: string | null
    material: string | null
    finish: string | null
    priceDelta: number | null
    priceOverride: number | null
    stockQuantity: number
    isAvailable: boolean
  }>
} {
  const image = product.images?.find((img: any) => img.isMain) || product.images?.[0]

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: money(product.price),
    categories: Array.isArray(product.categories) ? product.categories.map((c: any) => c.slug) : [],
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isPersonalizable: product.isPersonalizable,
    status: product.status,
    description: product.description || product.shortDescription || '',
    imageUrl: image?.url || product.imageUrl || '',
    stock: product.stock || 0,
    underOrder: product.underOrder || false,
    sku: product.sku || '',
    productionMinutesPerUnit: product.productionMinutesPerUnit ?? null,
    visibility: product.visibility === 'internal' ? 'internal' : 'public',
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant: any) => ({
          id: String(variant.id),
          name: variant.name || 'Padrão',
          sku: variant.sku || null,
          color: variant.color || null,
          size: variant.size || null,
          material: variant.material || null,
          finish: variant.finish || null,
          priceDelta: variant.priceDelta != null ? Number(variant.priceDelta) : null,
          priceOverride: variant.priceOverride != null ? Number(variant.priceOverride) : null,
          stockQuantity: typeof variant.stockQuantity === 'number' ? variant.stockQuantity : 0,
          isAvailable: variant.isAvailable !== false,
        }))
      : [],
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
    htmlContent: banner.htmlContent || '',
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
    discountTotal: money(order.discountTotal ?? 0),
    couponCode: typeof paymentPayload?.couponCode === 'string' ? paymentPayload.couponCode : null,
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
      variantId: item.variantId ?? null,
      variantName: item.variant?.name ?? item.variantName ?? null,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      observation: item.personalizationJson || item.observation || undefined,
    })),
    trackingCode: order.trackingCode || null,
    expectedDeliveryAt:
      order.expectedDeliveryAt instanceof Date
        ? order.expectedDeliveryAt.toISOString()
        : order.expectedDeliveryAt || null,
    productionTimeline: (order.productionTimeline && typeof order.productionTimeline === 'object'
      ? order.productionTimeline
      : null) as Record<string, string | null> | null,
    currentStageNote: order.currentStageNote ?? null,
  }
}

export async function listProducts() {
  if (!hasDatabase || !prisma?.product) {
    return readDB().products
  }

  try {
    const products = await prisma.product.findMany({
      include: {
        categories: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { name: 'asc' } },
      },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    })

    return products.map(serializeProduct)
  } catch (error) {
    reportDbError('listProducts Prisma failed, using fallback', error)
    return readDB().products
  }
}

function sanitizeProductionMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return Math.floor(num)
}

export async function createProduct(data: Product) {
  const productionMinutes = sanitizeProductionMinutes((data as any).productionMinutesPerUnit)

  if (!hasDatabase || !prisma?.product) {
    const db = readDB()
    const newProduct: Product = {
      ...data,
      id: `prod_${Date.now()}`,
      productionMinutesPerUnit: productionMinutes,
    }
    db.products.push(newProduct)
    writeDB(db)
    return newProduct
  }

  try {
    const categorySlugs: string[] = Array.isArray((data as any).categories) ? (data as any).categories : []
    const categoryRows = categorySlugs.length > 0
      ? await prisma.category.findMany({ where: { slug: { in: categorySlugs } }, select: { id: true } })
      : []

    const persistedMain = data.imageUrl
      ? await persistImageIfDataUrl(data.imageUrl, 'products')
      : null

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        sku: data.sku || null,
        description: data.description || null,
        shortDescription: data.description || null,
        price: data.price,
        categories: categoryRows.length > 0 ? { connect: categoryRows } : undefined,
        isPersonalizable: data.isPersonalizable,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        status: data.status,
        stock: data.stock || 0,
        underOrder: data.underOrder || false,
        productionMinutesPerUnit: productionMinutes,
        visibility: (data as any).visibility === 'internal' ? 'internal' : 'public',
        images: persistedMain
          ? { create: [{ url: persistedMain.url, storageKey: persistedMain.storageKey, alt: data.name, isMain: true }] }
          : undefined,
      },
      include: { categories: true, images: true, variants: { orderBy: { name: 'asc' } } },
    })

    return serializeProduct(product)
  } catch (error) {
    reportDbError('createProduct Prisma failed, using fallback', error)
    const db = readDB()
    const newProduct: Product = {
      ...data,
      id: `prod_${Date.now()}`,
      productionMinutesPerUnit: productionMinutes,
    }
    db.products.push(newProduct)
    writeDB(db)
    return newProduct
  }
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const hasProductionMinutesField = Object.prototype.hasOwnProperty.call(data, 'productionMinutesPerUnit')
  const productionMinutes = hasProductionMinutesField
    ? sanitizeProductionMinutes((data as any).productionMinutesPerUnit)
    : undefined

  if (!hasDatabase || !prisma?.product) {
    const db = readDB()
    const index = db.products.findIndex(product => product.id === id)
    if (index === -1) return null
    db.products[index] = {
      ...db.products[index],
      ...data,
      ...(hasProductionMinutesField ? { productionMinutesPerUnit: productionMinutes ?? null } : {}),
    }
    writeDB(db)
    return db.products[index]
  }

  try {
    const hasCategoriesField = Object.prototype.hasOwnProperty.call(data, 'categories')
    let categoriesUpdate: { set: { id: string }[] } | undefined
    if (hasCategoriesField) {
      const slugs: string[] = Array.isArray((data as any).categories) ? (data as any).categories : []
      const rows = slugs.length > 0
        ? await prisma.category.findMany({ where: { slug: { in: slugs } }, select: { id: true } })
        : []
      categoriesUpdate = { set: rows }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        sku: data.sku,
        description: data.description,
        shortDescription: data.description,
        price: data.price,
        ...(categoriesUpdate !== undefined ? { categories: categoriesUpdate } : {}),
        isPersonalizable: data.isPersonalizable,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        status: data.status,
        stock: data.stock,
        underOrder: data.underOrder,
        ...(hasProductionMinutesField ? { productionMinutesPerUnit: productionMinutes } : {}),
        ...(Object.prototype.hasOwnProperty.call(data, 'visibility')
          ? { visibility: (data as any).visibility === 'internal' ? 'internal' : 'public' }
          : {}),
      },
      include: { categories: true, images: true },
    })

    if (data.imageUrl !== undefined) {
      // Substitui apenas a imagem principal existente; preserva as demais imagens da galeria
      const existingMain = await prisma.productImage.findFirst({ where: { productId: id, isMain: true } })
      if (data.imageUrl) {
        const persisted = await persistImageIfDataUrl(data.imageUrl, 'products')
        if (existingMain) {
          // Se a imagem principal mudou e tinha storageKey antigo, tenta limpar do R2.
          if (existingMain.storageKey && existingMain.storageKey !== persisted.storageKey) {
            try {
              await getStorage().delete(existingMain.storageKey)
            } catch (deleteError) {
              console.warn('[database] storage delete (updateProduct main) falhou:', deleteError)
            }
          }
          await prisma.productImage.update({
            where: { id: existingMain.id },
            data: { url: persisted.url, storageKey: persisted.storageKey, alt: product.name },
          })
        } else {
          await prisma.productImage.create({
            data: {
              productId: id,
              url: persisted.url,
              storageKey: persisted.storageKey,
              alt: product.name,
              isMain: true,
            },
          })
        }
      } else if (existingMain) {
        // Removendo a imagem principal: limpa do storage externo se houver.
        if (existingMain.storageKey) {
          try {
            await getStorage().delete(existingMain.storageKey)
          } catch (deleteError) {
            console.warn('[database] storage delete (updateProduct remove main) falhou:', deleteError)
          }
        }
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

    const final = serializeProduct(await prisma.product.findUniqueOrThrow({ where: { id }, include: { categories: true, images: true, variants: { orderBy: { name: 'asc' } } } }))
    // Best-effort restock notifications when the product is now in stock /
    // under order. Won't email anyone if there are no pending subscribers.
    dispatchRestockNotificationsIfNeeded(id).catch(() => {})
    return final
  } catch (error) {
    reportDbError('updateProduct Prisma failed, using fallback', error)
    const db = readDB()
    const index = db.products.findIndex(product => product.id === id)
    if (index === -1) return null
    db.products[index] = {
      ...db.products[index],
      ...data,
      ...(hasProductionMinutesField ? { productionMinutesPerUnit: productionMinutes ?? null } : {}),
    }
    writeDB(db)
    return db.products[index]
  }
}

export type ProductImageDto = {
  id: string
  url: string
  storageKey: string | null
  alt: string | null
  sortOrder: number
  isMain: boolean
  variantId: string | null
}

const MAX_PRODUCT_IMAGES = 8

function serializeProductImage(img: any): ProductImageDto {
  return {
    id: img.id,
    url: img.url,
    storageKey: img.storageKey || null,
    alt: img.alt || null,
    sortOrder: img.sortOrder,
    isMain: img.isMain,
    variantId: img.variantId || null,
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
    reportDbError('listProductImages Prisma failed', error)
    return []
  }
}

export async function addProductImage(
  productId: string,
  data: { url: string; alt?: string; storageKey?: string | null; variantId?: string | null }
): Promise<{ image: ProductImageDto | null; error?: string }> {
  if (!hasDatabase || !prisma?.productImage || !prisma?.product) {
    return { image: null, error: 'Banco de dados indisponível.' }
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { _count: { select: { images: true } } } })
    if (!product) return { image: null, error: 'Produto não encontrado.' }
    if (product._count.images >= MAX_PRODUCT_IMAGES) {
      return { image: null, error: `Limite de ${MAX_PRODUCT_IMAGES} imagens por produto.` }
    }

    // Se variantId foi informado, garante que a variação pertence ao produto.
    let resolvedVariantId: string | null = null
    if (data.variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: data.variantId, productId },
        select: { id: true },
      })
      if (!variant) return { image: null, error: 'Variação não encontrada para este produto.' }
      resolvedVariantId = variant.id
    }

    const isFirst = product._count.images === 0
    const maxSortOrder = await prisma.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } })
    const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

    // Se a `url` recebida for uma data URL e o caller não tiver feito o upload,
    // delega ao storage adapter aqui (R2 ou inline).
    let finalUrl = data.url
    let finalStorageKey = data.storageKey ?? null
    if (finalStorageKey === null && isDataUrl(finalUrl)) {
      const persisted = await persistImageIfDataUrl(finalUrl, 'products')
      finalUrl = persisted.url
      finalStorageKey = persisted.storageKey
    }

    const image = await prisma.productImage.create({
      data: {
        productId,
        variantId: resolvedVariantId,
        url: finalUrl,
        storageKey: finalStorageKey,
        alt: data.alt || product.name,
        sortOrder,
        isMain: isFirst,
      },
    })
    return { image: serializeProductImage(image) }
  } catch (error) {
    reportDbError('addProductImage Prisma failed', error)
    return { image: null, error: 'Erro ao salvar imagem.' }
  }
}

export async function setVariantForImage(
  productId: string,
  imageId: string,
  variantId: string | null
): Promise<{ ok: boolean; image?: ProductImageDto; error?: string }> {
  if (!hasDatabase || !prisma?.productImage) {
    return { ok: false, error: 'Banco de dados indisponível.' }
  }

  try {
    const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } })
    if (!image) return { ok: false, error: 'Imagem não encontrada.' }

    if (variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: variantId, productId },
        select: { id: true },
      })
      if (!variant) return { ok: false, error: 'Variação não encontrada para este produto.' }
    }

    const updated = await prisma.productImage.update({
      where: { id: imageId },
      data: { variantId: variantId || null },
    })
    return { ok: true, image: serializeProductImage(updated) }
  } catch (error) {
    reportDbError('setVariantForImage Prisma failed', error)
    return { ok: false, error: 'Erro ao vincular imagem à variação.' }
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

    // Best-effort: remove o objeto do storage externo. Não falhar a operação se
    // o R2 estiver inacessível — o registro já foi removido do DB.
    if (image.storageKey) {
      try {
        await getStorage().delete(image.storageKey)
      } catch (deleteError) {
        console.warn('[database] storage delete (removeProductImage) falhou:', deleteError)
      }
    }
    return { ok: true }
  } catch (error) {
    reportDbError('removeProductImage Prisma failed', error)
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
    reportDbError('setMainProductImage Prisma failed', error)
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
    reportDbError('reorderProductImages Prisma failed', error)
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
    reportDbError('deleteProduct Prisma failed', error)
    return false
  }
}

export type BulkProductUpdate = {
  isActive?: boolean
  isFeatured?: boolean
  isPersonalizable?: boolean
  underOrder?: boolean
  status?: string
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
    reportDbError('updateProductsBulk Prisma failed', error)
    return { updated: 0, error: 'Erro ao atualizar produtos no banco.' }
  }
}

export async function listCategories() {
  if (!hasDatabase || !prisma?.category) return readDB().categories
  try {
    const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    return categories.map(serializeCategory)
  } catch (error) {
    reportDbError('listCategories Prisma failed, using fallback', error)
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
    reportDbError('createCategory Prisma failed, using fallback', error)
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
    reportDbError('updateCategory Prisma failed, using fallback', error)
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
    reportDbError('deleteCategory Prisma failed', error)
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
    reportDbError('listCustomers Prisma failed, using fallback', error)
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
    reportDbError('createCustomer Prisma failed, using fallback', error)
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
    reportDbError('updateCustomer Prisma failed, using fallback', error)
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
    reportDbError('getCustomerById Prisma failed, using fallback', error)
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
    reportDbError('getCustomerByEmail Prisma failed, using fallback', error)
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
        include: { address: true, payment: true, items: { include: { variant: true } } },
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
    reportDbError('listOrdersByCustomerEmail Prisma failed, using fallback', error)
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
    reportDbError('listAddressesByCustomerId Prisma failed, using fallback', error)
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
    reportDbError('createAddress Prisma failed', error)
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
    reportDbError('updateAddress Prisma failed', error)
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
    reportDbError('deleteAddress Prisma failed', error)
    return false
  }
}

export async function listBanners() {
  if (!hasDatabase || !prisma?.banner) return readDB().banners
  try {
    const banners = await prisma.banner.findMany({ orderBy: { createdAt: 'desc' } })
    return banners.map(serializeBanner)
  } catch (error) {
    reportDbError('listBanners Prisma failed, using fallback', error)
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
    const created = await prisma.banner.create({ data })
    return serializeBanner(created)
  } catch (error) {
    reportDbError('createBanner Prisma failed, using fallback', error)
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
    reportDbError('updateBanner Prisma failed, using fallback', error)
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
    reportDbError('deleteBanner Prisma failed', error)
    return false
  }
}

export async function listOrders() {
  if (!hasDatabase || !prisma?.order) return readDB().orders
  try {
    const orders = await prisma.order.findMany({
      include: { address: true, payment: true, items: { include: { variant: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(serializeOrder)
  } catch (error) {
    reportDbError('listOrders Prisma failed, using fallback', error)
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
      include: { address: true, payment: true, items: { include: { variant: true } } },
    })
    return order ? serializeOrder(order) : null
  } catch (error) {
    reportDbError('getOrderByNumber Prisma failed, using fallback', error)
    return readDB().orders.find(order => order.orderNumber === orderNumber) || null
  }
}

export async function getOrderByTrackingCode(trackingCode: string) {
  const code = trackingCode?.trim()
  if (!code) return null

  if (!hasDatabase || !prisma?.order) {
    return readDB().orders.find(order => order.trackingCode === code) || null
  }

  try {
    const order = await prisma.order.findFirst({
      where: { trackingCode: code },
      include: { address: true, payment: true, items: { include: { variant: true } } },
    })
    return order ? serializeOrder(order) : null
  } catch (error) {
    reportDbError('getOrderByTrackingCode Prisma failed, using fallback', error)
    return readDB().orders.find(order => order.trackingCode === code) || null
  }
}

export async function anonymizeCustomer(customerId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  if (!customerId) return { ok: false, error: 'invalid_input' }

  const placeholderEmail = `removed-${customerId}@deleted.local`
  const placeholderName = 'Cliente removido'

  if (!hasDatabase || !prisma?.customer) {
    const db = readDB()
    const idx = db.users.findIndex(u => u.id === customerId)
    if (idx === -1) return { ok: false, error: 'not_found' }
    db.users[idx] = {
      ...db.users[idx],
      name: placeholderName,
      email: placeholderEmail,
      phone: undefined,
      cpf: undefined,
      passwordHash: undefined,
      googleId: undefined,
      isVerified: false,
      updatedAt: new Date().toISOString(),
    }
    db.wishlistItems = (db.wishlistItems || []).filter(w => w.customerId !== customerId)
    db.passwordResetTokens = (db.passwordResetTokens || []).filter(t => t.adminUserId !== customerId)
    writeDB(db)
    return { ok: true }
  }

  try {
    await prisma.$transaction(async tx => {
      // Wipe related personal records first.
      await tx.customerAddress.deleteMany({ where: { customerId } })
      const wishlistClient = (tx as any).wishlistItem
      if (wishlistClient) await wishlistClient.deleteMany({ where: { customerId } })

      await tx.customer.update({
        where: { id: customerId },
        data: {
          name: placeholderName,
          email: placeholderEmail,
          phone: null,
          cpf: null,
          isVerified: false,
        },
      })

      // Order history is preserved (Order has its own snapshot fields). We
      // only blank the customerId link by leaving the FK as is — pedidos
      // continuam ligados pelo customerEmail antigo (já desligado), mas
      // não vinculados ao Customer renomeado.
      await tx.order.updateMany({
        where: { customerEmail: { equals: email, mode: 'insensitive' } },
        data: { customerId: null },
      })
    })
    return { ok: true }
  } catch (error) {
    reportDbError('anonymizeCustomer Prisma failed', error)
    return { ok: false, error: 'persist_failed' }
  }
}

export async function cancelOrderByOwner(
  orderNumber: string,
  customerEmail: string,
): Promise<{ ok: boolean; error?: 'not_found' | 'not_owner' | 'not_cancellable'; orderStatus?: string }> {
  const normalized = customerEmail.trim().toLowerCase()

  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const idx = db.orders.findIndex(o => o.orderNumber === orderNumber)
    if (idx === -1) return { ok: false, error: 'not_found' }
    if (db.orders[idx].customerEmail.toLowerCase() !== normalized) return { ok: false, error: 'not_owner' }
    if (db.orders[idx].paymentStatus !== 'pending' || db.orders[idx].status === 'cancelled') {
      return { ok: false, error: 'not_cancellable' }
    }
    db.orders[idx].status = 'cancelled'
    db.orders[idx].paymentStatus = 'cancelled'
    db.orders[idx].fulfillmentStatus = 'cancelled'
    writeDB(db)
    return { ok: true, orderStatus: 'cancelled' }
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, customerEmail: true, status: true, paymentStatus: true },
    })
    if (!order) return { ok: false, error: 'not_found' }
    if (order.customerEmail.toLowerCase() !== normalized) return { ok: false, error: 'not_owner' }
    if (order.paymentStatus !== 'pending' || order.status === 'cancelled') {
      return { ok: false, error: 'not_cancellable' }
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          paymentStatus: 'cancelled',
          fulfillmentStatus: 'cancelled',
        },
      }),
      prisma.payment.updateMany({
        where: { orderId: order.id },
        data: { status: 'cancelled' },
      }),
    ])
    return { ok: true, orderStatus: 'cancelled' }
  } catch (error) {
    reportDbError('cancelOrderByOwner Prisma failed', error)
    return { ok: false, error: 'not_cancellable' }
  }
}

export async function setOrderFulfillmentByTracking(
  trackingCode: string,
  fulfillmentStatus: string,
): Promise<{ ok: boolean; orderNumber?: string; previousStatus?: string }> {
  const code = trackingCode?.trim()
  if (!code) return { ok: false }

  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const idx = db.orders.findIndex(order => order.trackingCode === code)
    if (idx === -1) return { ok: false }
    const previous = db.orders[idx].fulfillmentStatus
    db.orders[idx].fulfillmentStatus = fulfillmentStatus
    writeDB(db)
    return { ok: true, orderNumber: db.orders[idx].orderNumber, previousStatus: previous }
  }

  try {
    const order = await prisma.order.findFirst({
      where: { trackingCode: code },
      select: { orderNumber: true, fulfillmentStatus: true },
    })
    if (!order) return { ok: false }
    if (order.fulfillmentStatus === fulfillmentStatus) {
      return { ok: true, orderNumber: order.orderNumber, previousStatus: order.fulfillmentStatus }
    }
    await prisma.order.updateMany({
      where: { trackingCode: code },
      data: { fulfillmentStatus },
    })
    return { ok: true, orderNumber: order.orderNumber, previousStatus: order.fulfillmentStatus }
  } catch (error) {
    reportDbError('setOrderFulfillmentByTracking Prisma failed', error)
    return { ok: false }
  }
}

export async function getOrderByIdOrNumber(idOrNumber: string) {
  if (!hasDatabase || !prisma?.order) {
    const orders = readDB().orders
    return (
      orders.find(order => order.id === idOrNumber) ||
      orders.find(order => order.orderNumber === idOrNumber) ||
      null
    )
  }

  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      include: { address: true, payment: true, items: { include: { variant: true } } },
    })
    return order ? serializeOrder(order) : null
  } catch (error) {
    reportDbError('getOrderByIdOrNumber Prisma failed, using fallback', error)
    const orders = readDB().orders
    return (
      orders.find(order => order.id === idOrNumber) ||
      orders.find(order => order.orderNumber === idOrNumber) ||
      null
    )
  }
}

export async function createOrder(data: Order & { discountTotal?: number; couponCode?: string | null }) {
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
        discountTotal: typeof data.discountTotal === 'number' ? data.discountTotal : 0,
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
            variantId: item.variantId ?? null,
            productNameSnapshot: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            personalizationJson: item.observation || null,
          })),
        },
      },
      include: { address: true, payment: true, items: { include: { variant: true } } },
    })

    // Fase 4 SPEC-001: alerta proativo de componentes em falta.
    // Roda em background — não bloqueia checkout (regra do stakeholder:
    // pedido nunca é bloqueado, só avisamos pra repor).
    void checkOrderShortages(order.id).then(shortages => {
      if (shortages.length > 0) {
        fireOrderShortageAlertInBackground({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          orderId: order.id,
          shortages,
        })
      }
    }).catch(() => {})

    return serializeOrder(order)
  } catch (error) {
    reportDbError('createOrder Prisma failed, using fallback', error)
    const db = readDB()
    const newOrder: Order = { ...data, id: `order_${Date.now()}` }
    db.orders.unshift(newOrder)
    writeDB(db)
    return newOrder
  }
}

type OrderUpdateData = Partial<Order> & {
  productionTimeline?: ProductionTimeline | null
  currentStageNote?: string | null
}

export async function updateOrder(id: string, data: OrderUpdateData) {
  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const index = db.orders.findIndex(order => order.id === id)
    if (index === -1) return null

    const previous = db.orders[index]
    const localAutoTransition =
      data.paymentStatus === 'paid' &&
      !data.fulfillmentStatus &&
      previous.paymentStatus !== 'paid' &&
      previous.fulfillmentStatus === 'pending'

    const localPatch: Partial<Order> = localAutoTransition
      ? {
          fulfillmentStatus: 'aguardando_producao',
          productionTimeline: withTimelineStamp(
            previous.productionTimeline as ProductionTimeline | null | undefined,
            'aguardando_producao',
          ),
        }
      : {}

    db.orders[index] = { ...previous, ...data, ...localPatch }
    writeDB(db)
    return db.orders[index]
  }

  try {
    // Aceita string ISO, Date, '' (limpa) e null. undefined = não mexer.
    let expectedDelivery: Date | null | undefined
    if (Object.prototype.hasOwnProperty.call(data, 'expectedDeliveryAt')) {
      const raw = (data as { expectedDeliveryAt?: string | Date | null }).expectedDeliveryAt
      if (raw === null || raw === '') {
        expectedDelivery = null
      } else if (raw instanceof Date) {
        expectedDelivery = raw
      } else if (typeof raw === 'string') {
        const parsed = new Date(raw)
        expectedDelivery = Number.isNaN(parsed.getTime()) ? undefined : parsed
      }
    }

    const timelinePatch: Pick<Prisma.OrderUpdateInput, 'productionTimeline'> | Record<string, never> =
      Object.prototype.hasOwnProperty.call(data, 'productionTimeline') && data.productionTimeline
        ? { productionTimeline: data.productionTimeline as Prisma.InputJsonValue }
        : Object.prototype.hasOwnProperty.call(data, 'productionTimeline')
          ? { productionTimeline: Prisma.JsonNull }
          : {}

    const stageNotePatch: Pick<Prisma.OrderUpdateInput, 'currentStageNote'> | Record<string, never> =
      Object.prototype.hasOwnProperty.call(data, 'currentStageNote')
        ? { currentStageNote: data.currentStageNote ?? null }
        : {}

    let autoTransitionPatch: Pick<Prisma.OrderUpdateInput, 'fulfillmentStatus' | 'productionTimeline'> | Record<string, never> = {}
    if (
      data.paymentStatus === 'paid' &&
      !data.fulfillmentStatus &&
      !Object.prototype.hasOwnProperty.call(data, 'productionTimeline')
    ) {
      const previous = await prisma.order.findUnique({
        where: { id },
        select: { paymentStatus: true, fulfillmentStatus: true, productionTimeline: true },
      })

      if (previous && previous.paymentStatus !== 'paid' && previous.fulfillmentStatus === 'pending') {
        const nextTimeline = withTimelineStamp(
          previous.productionTimeline as ProductionTimeline | null | undefined,
          'aguardando_producao',
        )
        autoTransitionPatch = {
          fulfillmentStatus: 'aguardando_producao',
          productionTimeline: nextTimeline as Prisma.InputJsonValue,
        }
      }
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
        ...(expectedDelivery !== undefined ? { expectedDeliveryAt: expectedDelivery } : {}),
        ...timelinePatch,
        ...stageNotePatch,
        ...autoTransitionPatch,
      },
      include: { address: true, payment: true, items: { include: { variant: true } } },
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
          variantId: (item as any).variantId ?? null,
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
    reportDbError('updateOrder Prisma failed, using fallback', error)
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

    const previous = db.orders[index]
    const autoTransition =
      data.paymentStatus === 'paid' &&
      previous.paymentStatus !== 'paid' &&
      previous.fulfillmentStatus === 'pending'

    const nextTimeline = autoTransition
      ? withTimelineStamp(previous.productionTimeline as ProductionTimeline | null | undefined, 'aguardando_producao')
      : previous.productionTimeline

    db.orders[index] = {
      ...previous,
      paymentStatus: data.paymentStatus,
      status: data.status,
      paymentMethod: data.method,
      ...(autoTransition ? { fulfillmentStatus: 'aguardando_producao' } : {}),
      productionTimeline: nextTimeline ?? null,
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
    const previous = await prisma.order.findUnique({
      where: { orderNumber },
      select: { paymentStatus: true, fulfillmentStatus: true, productionTimeline: true },
    })

    const autoTransition =
      previous &&
      data.paymentStatus === 'paid' &&
      previous.paymentStatus !== 'paid' &&
      previous.fulfillmentStatus === 'pending'

    const nextTimeline = autoTransition
      ? withTimelineStamp(previous.productionTimeline as ProductionTimeline | null | undefined, 'aguardando_producao')
      : null

    const order = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: data.status,
        paymentStatus: data.paymentStatus,
        ...(autoTransition && nextTimeline
          ? {
              fulfillmentStatus: 'aguardando_producao',
              productionTimeline: nextTimeline as Prisma.InputJsonValue,
            }
          : {}),
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
      include: { address: true, payment: true, items: { include: { variant: true } } },
    })

    if (data.rawPayload?.paidAt && order.payment?.id) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { paidAt: new Date(String(data.rawPayload.paidAt)) },
      })
    }

    return serializeOrder(await prisma.order.findUniqueOrThrow({
      where: { orderNumber },
      include: { address: true, payment: true, items: { include: { variant: true } } },
    }))
  } catch (error) {
    reportDbError('updateOrderPaymentByNumber Prisma failed', error)
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
    reportDbError('deleteOrder Prisma failed', error)
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
    reportDbError('readSettingsRecord Prisma failed, using fallback', error)
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
    reportDbError('updateProductionSettings Prisma failed', error)
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
    reportDbError('listProductionTasks Prisma failed, using fallback', error)
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
    reportDbError('computeSummary Prisma failed', error)
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
    reportDbError('getProductionTask Prisma failed', error)
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

      // Fase 3 SPEC-001: debita componentes do estoque proporcional ao
      // delta produzido. Roda DENTRO da transação pra ser atômico com
      // o ProductionLog — se rollback, estoque também volta.
      const consumption = await applyProductionConsumption(tx, {
        taskId: id,
        delta: computed.delta,
        actorEmail: actor.email || null,
      })

      orderIdForRefresh = updated.orderId
      return { ok: true as const, consumption }
    })

    if (!result.ok) return { ok: false, error: result.error }

    if (orderIdForRefresh) {
      await refreshOrderFulfillmentFromProduction(orderIdForRefresh)
    }

    // Fase 4 SPEC-001: dispara alertas de estoque baixo APÓS o commit.
    // Throttle de 6h por componente é tratado dentro do helper.
    if (result.consumption) {
      for (const trigger of result.consumption.triggeredLowStock) {
        fireLowStockAlertInBackground(trigger.componentId)
      }
    }

    const refreshed = await getProductionTask(id)
    if (!refreshed) return { ok: false, error: 'Tarefa não encontrada após atualização.' }
    return { ok: true, task: refreshed }
  } catch (error) {
    reportDbError('updateProductionTask Prisma failed', error)
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
          reportDbError('ensureProductionTasksForOrder create failed', err)
        }
      }
    }

    return { created }
  } catch (error) {
    reportDbError('ensureProductionTasksForOrder Prisma failed', error)
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
    reportDbError('syncProductionTasksForPaidOrders Prisma failed', error)
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
    reportDbError('getCustomerOrderProduction Prisma failed', error)
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
    reportDbError('refreshOrderFulfillmentFromProduction Prisma failed', error)
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

// =====================================================
// COUPONS
// =====================================================

function serializeCoupon(coupon: any): CouponRecord {
  const toIso = (value: any): string | null => {
    if (!value) return null
    if (value instanceof Date) return value.toISOString()
    return String(value)
  }

  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type === 'percentage' ? 'percentage' : 'fixed',
    value: money(coupon.value),
    minSubtotal: coupon.minSubtotal != null ? money(coupon.minSubtotal) : null,
    startsAt: toIso(coupon.startsAt),
    endsAt: toIso(coupon.endsAt),
    usageLimit: typeof coupon.usageLimit === 'number' ? coupon.usageLimit : (coupon.usageLimit ?? null),
    usedCount: typeof coupon.usedCount === 'number' ? coupon.usedCount : 0,
    isActive: Boolean(coupon.isActive),
    createdAt: toIso(coupon.createdAt) || new Date().toISOString(),
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function computeCouponDiscount(type: 'fixed' | 'percentage', value: number, subtotal: number) {
  if (type === 'fixed') {
    return round2(Math.min(value, subtotal))
  }
  // percentage
  return round2(subtotal * (value / 100))
}

export type CouponInput = {
  code: string
  type: 'fixed' | 'percentage'
  value: number
  minSubtotal?: number | null
  startsAt?: string | null
  endsAt?: string | null
  usageLimit?: number | null
  isActive?: boolean
}

export async function listCoupons(): Promise<CouponRecord[]> {
  if (!hasDatabase || !prisma?.coupon) {
    const db = readDB()
    return [...db.coupons].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })
    return coupons.map(serializeCoupon)
  } catch (error) {
    reportDbError('listCoupons Prisma failed, using fallback', error)
    const db = readDB()
    return [...db.coupons].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }
}

export async function getCouponByCode(code: string): Promise<CouponRecord | null> {
  const upper = String(code || '').trim().toUpperCase()
  if (!upper) return null
  if (!hasDatabase || !prisma?.coupon) {
    const db = readDB()
    return db.coupons.find(c => c.code.toUpperCase() === upper) || null
  }
  try {
    const coupon = await prisma.coupon.findUnique({ where: { code: upper } })
    return coupon ? serializeCoupon(coupon) : null
  } catch (error) {
    reportDbError('getCouponByCode Prisma failed, using fallback', error)
    const db = readDB()
    return db.coupons.find(c => c.code.toUpperCase() === upper) || null
  }
}

export async function createCoupon(data: CouponInput): Promise<{ coupon: CouponRecord | null; error?: string }> {
  const code = String(data.code || '').trim().toUpperCase()
  if (!code) return { coupon: null, error: 'Código do cupom é obrigatório.' }
  if (data.type !== 'fixed' && data.type !== 'percentage') {
    return { coupon: null, error: 'Tipo do cupom deve ser "fixed" ou "percentage".' }
  }
  const value = Number(data.value)
  if (!Number.isFinite(value) || value <= 0) {
    return { coupon: null, error: 'Valor do cupom deve ser maior que zero.' }
  }
  if (data.type === 'percentage' && value > 100) {
    return { coupon: null, error: 'Cupom percentual não pode exceder 100%.' }
  }
  const minSubtotal = data.minSubtotal != null && data.minSubtotal !== undefined ? Number(data.minSubtotal) : null
  if (minSubtotal != null && (!Number.isFinite(minSubtotal) || minSubtotal < 0)) {
    return { coupon: null, error: 'Subtotal mínimo inválido.' }
  }
  const startsAt = data.startsAt ? new Date(data.startsAt) : null
  const endsAt = data.endsAt ? new Date(data.endsAt) : null
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
    return { coupon: null, error: 'Data de início deve ser anterior à data de término.' }
  }
  const usageLimit = data.usageLimit != null && data.usageLimit !== undefined ? Number(data.usageLimit) : null
  if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
    return { coupon: null, error: 'Limite de uso deve ser inteiro >= 1.' }
  }
  const isActive = data.isActive !== false

  if (!hasDatabase || !prisma?.coupon) {
    const db = readDB()
    if (db.coupons.some(c => c.code.toUpperCase() === code)) {
      return { coupon: null, error: 'Já existe um cupom com este código.' }
    }
    const newCoupon: CouponRecord = {
      id: `coupon_${Date.now()}`,
      code,
      type: data.type,
      value,
      minSubtotal,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      usageLimit,
      usedCount: 0,
      isActive,
      createdAt: new Date().toISOString(),
    }
    db.coupons.push(newCoupon)
    writeDB(db)
    return { coupon: newCoupon }
  }

  try {
    const existing = await prisma.coupon.findUnique({ where: { code } })
    if (existing) {
      return { coupon: null, error: 'Já existe um cupom com este código.' }
    }
    const created = await prisma.coupon.create({
      data: {
        code,
        type: data.type,
        value,
        minSubtotal: minSubtotal != null ? minSubtotal : null,
        startsAt,
        endsAt,
        usageLimit,
        isActive,
      },
    })
    return { coupon: serializeCoupon(created) }
  } catch (error) {
    reportDbError('createCoupon Prisma failed', error)
    return { coupon: null, error: 'Erro ao criar cupom.' }
  }
}

export async function updateCoupon(id: string, data: Partial<CouponInput>): Promise<{ coupon: CouponRecord | null; error?: string }> {
  if (!id) return { coupon: null, error: 'ID do cupom é obrigatório.' }

  const updateData: Record<string, any> = {}
  if (data.code !== undefined) {
    const code = String(data.code).trim().toUpperCase()
    if (!code) return { coupon: null, error: 'Código do cupom é obrigatório.' }
    updateData.code = code
  }
  if (data.type !== undefined) {
    if (data.type !== 'fixed' && data.type !== 'percentage') {
      return { coupon: null, error: 'Tipo do cupom inválido.' }
    }
    updateData.type = data.type
  }
  if (data.value !== undefined) {
    const value = Number(data.value)
    if (!Number.isFinite(value) || value <= 0) {
      return { coupon: null, error: 'Valor do cupom deve ser maior que zero.' }
    }
    updateData.value = value
  }
  if (data.minSubtotal !== undefined) {
    if (data.minSubtotal === null) {
      updateData.minSubtotal = null
    } else {
      const minSubtotal = Number(data.minSubtotal)
      if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
        return { coupon: null, error: 'Subtotal mínimo inválido.' }
      }
      updateData.minSubtotal = minSubtotal
    }
  }
  if (data.startsAt !== undefined) {
    updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null
  }
  if (data.endsAt !== undefined) {
    updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null
  }
  if (updateData.startsAt && updateData.endsAt && updateData.startsAt.getTime() >= updateData.endsAt.getTime()) {
    return { coupon: null, error: 'Data de início deve ser anterior à data de término.' }
  }
  if (data.usageLimit !== undefined) {
    if (data.usageLimit === null) {
      updateData.usageLimit = null
    } else {
      const usageLimit = Number(data.usageLimit)
      if (!Number.isInteger(usageLimit) || usageLimit < 1) {
        return { coupon: null, error: 'Limite de uso deve ser inteiro >= 1.' }
      }
      updateData.usageLimit = usageLimit
    }
  }
  if (data.isActive !== undefined) {
    updateData.isActive = Boolean(data.isActive)
  }

  // Validate type/value combination if either was updated
  const finalType = updateData.type
  const finalValue = updateData.value
  if (finalType === 'percentage' && typeof finalValue === 'number' && finalValue > 100) {
    return { coupon: null, error: 'Cupom percentual não pode exceder 100%.' }
  }

  if (!hasDatabase || !prisma?.coupon) {
    const db = readDB()
    const index = db.coupons.findIndex(c => c.id === id)
    if (index === -1) return { coupon: null, error: 'Cupom não encontrado.' }

    if (updateData.code && db.coupons.some((c, i) => i !== index && c.code.toUpperCase() === updateData.code)) {
      return { coupon: null, error: 'Já existe um cupom com este código.' }
    }

    // Cross-field validation against existing record for percentage limits
    const merged = { ...db.coupons[index] }
    if (updateData.code !== undefined) merged.code = updateData.code
    if (updateData.type !== undefined) merged.type = updateData.type
    if (updateData.value !== undefined) merged.value = updateData.value
    if (updateData.minSubtotal !== undefined) merged.minSubtotal = updateData.minSubtotal
    if (updateData.startsAt !== undefined) merged.startsAt = updateData.startsAt ? updateData.startsAt.toISOString() : null
    if (updateData.endsAt !== undefined) merged.endsAt = updateData.endsAt ? updateData.endsAt.toISOString() : null
    if (updateData.usageLimit !== undefined) merged.usageLimit = updateData.usageLimit
    if (updateData.isActive !== undefined) merged.isActive = updateData.isActive

    if (merged.type === 'percentage' && merged.value > 100) {
      return { coupon: null, error: 'Cupom percentual não pode exceder 100%.' }
    }

    db.coupons[index] = merged
    writeDB(db)
    return { coupon: db.coupons[index] }
  }

  try {
    if (updateData.code) {
      const existing = await prisma.coupon.findUnique({ where: { code: updateData.code } })
      if (existing && existing.id !== id) {
        return { coupon: null, error: 'Já existe um cupom com este código.' }
      }
    }
    const updated = await prisma.coupon.update({ where: { id }, data: updateData })
    return { coupon: serializeCoupon(updated) }
  } catch (error) {
    reportDbError('updateCoupon Prisma failed', error)
    return { coupon: null, error: 'Erro ao atualizar cupom.' }
  }
}

export async function deleteCoupon(id: string): Promise<boolean> {
  if (!id) return false
  if (!hasDatabase || !prisma?.coupon) {
    const db = readDB()
    const index = db.coupons.findIndex(c => c.id === id)
    if (index === -1) return false
    db.coupons.splice(index, 1)
    writeDB(db)
    return true
  }
  try {
    await prisma.coupon.delete({ where: { id } })
    return true
  } catch (error) {
    reportDbError('deleteCoupon Prisma failed', error)
    return false
  }
}

export async function validateAndCalculateCoupon(
  code: string,
  subtotal: number
): Promise<
  | { ok: true; coupon: CouponRecord; discount: number }
  | { ok: false; error: string }
> {
  const trimmed = String(code || '').trim()
  if (!trimmed) return { ok: false, error: 'Informe um código de cupom.' }
  const safeSubtotal = Number(subtotal)
  if (!Number.isFinite(safeSubtotal) || safeSubtotal < 0) {
    return { ok: false, error: 'Subtotal inválido para validar o cupom.' }
  }

  const coupon = await getCouponByCode(trimmed)
  if (!coupon) return { ok: false, error: 'Cupom não encontrado.' }
  if (!coupon.isActive) return { ok: false, error: 'Este cupom está inativo.' }

  const now = Date.now()
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    return { ok: false, error: 'Este cupom ainda não está disponível.' }
  }
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
    return { ok: false, error: 'Este cupom expirou.' }
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, error: 'Este cupom atingiu o limite de uso.' }
  }
  if (coupon.minSubtotal != null && safeSubtotal < coupon.minSubtotal) {
    return {
      ok: false,
      error: `Este cupom requer subtotal mínimo de R$ ${coupon.minSubtotal.toFixed(2).replace('.', ',')}.`,
    }
  }

  const discount = computeCouponDiscount(coupon.type, coupon.value, safeSubtotal)
  if (discount <= 0) {
    return { ok: false, error: 'Cupom não gera desconto neste pedido.' }
  }
  return { ok: true, coupon, discount }
}

export async function incrementCouponUsage(code: string): Promise<void> {
  const upper = String(code || '').trim().toUpperCase()
  if (!upper) return
  if (!hasDatabase || !prisma?.coupon) {
    const db = readDB()
    const index = db.coupons.findIndex(c => c.code.toUpperCase() === upper)
    if (index === -1) return
    db.coupons[index].usedCount = (db.coupons[index].usedCount || 0) + 1
    writeDB(db)
    return
  }
  try {
    await prisma.coupon.update({
      where: { code: upper },
      data: { usedCount: { increment: 1 } },
    })
  } catch (error) {
    reportDbError('incrementCouponUsage Prisma failed', error)
  }
}

// ---------------------------------------------------------------------------
// Variações de produto (CRUD)
// ---------------------------------------------------------------------------

export type ProductVariantDto = {
  id: string
  productId: string
  name: string
  sku: string | null
  color: string | null
  size: string | null
  material: string | null
  finish: string | null
  priceDelta: number | null
  priceOverride: number | null
  stockQuantity: number
  isAvailable: boolean
  createdAt: string
  updatedAt: string
}

export type ProductVariantInput = {
  name?: string
  sku?: string | null
  color?: string | null
  size?: string | null
  material?: string | null
  finish?: string | null
  priceDelta?: number | null
  priceOverride?: number | null
  stockQuantity?: number
  isAvailable?: boolean
}

function serializeVariant(v: any): ProductVariantDto {
  const toIso = (d: any) =>
    d instanceof Date ? d.toISOString() : typeof d === 'string' ? d : new Date().toISOString()
  return {
    id: v.id,
    productId: v.productId,
    name: v.name,
    sku: v.sku ?? null,
    color: v.color ?? null,
    size: v.size ?? null,
    material: v.material ?? null,
    finish: v.finish ?? null,
    priceDelta: v.priceDelta != null ? Number(v.priceDelta) : null,
    priceOverride: v.priceOverride != null ? Number(v.priceOverride) : null,
    stockQuantity: typeof v.stockQuantity === 'number' ? v.stockQuantity : 0,
    isAvailable: v.isAvailable !== false,
    createdAt: toIso(v.createdAt),
    updatedAt: toIso(v.updatedAt),
  }
}

function sanitizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = String(value).trim()
  return trimmed.length === 0 ? null : trimmed
}

function sanitizeDecimalOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null
  return num
}

function validateVariantPricing(
  priceDelta: number | null | undefined,
  priceOverride: number | null | undefined
): string | null {
  const hasDelta = priceDelta !== undefined && priceDelta !== null
  const hasOverride = priceOverride !== undefined && priceOverride !== null
  if (hasDelta && hasOverride) {
    return 'Use priceDelta OU priceOverride, não ambos.'
  }
  if (hasOverride && (priceOverride as number) <= 0) {
    return 'priceOverride deve ser maior que zero.'
  }
  return null
}

function validateVariantStock(stock: unknown): { value: number } | { error: string } {
  if (stock === undefined) return { value: 0 }
  const num = typeof stock === 'number' ? stock : Number(stock)
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    return { error: 'stockQuantity deve ser inteiro >= 0.' }
  }
  return { value: num }
}

export async function listProductVariants(productId: string): Promise<ProductVariantDto[]> {
  if (!hasDatabase || !prisma?.productVariant) {
    const db = readDB()
    return (db.productVariants || [])
      .filter(v => v.productId === productId)
      .map(serializeVariant)
  }
  try {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ createdAt: 'asc' }],
    })
    return variants.map(serializeVariant)
  } catch (error) {
    reportDbError('listProductVariants Prisma failed', error)
    return []
  }
}

export async function createProductVariant(
  productId: string,
  input: ProductVariantInput
): Promise<{ ok: boolean; variant?: ProductVariantDto; error?: string }> {
  const name = sanitizeOptionalString(input.name)
  if (!name) return { ok: false, error: 'name é obrigatório.' }

  const stockResult = validateVariantStock(input.stockQuantity)
  if ('error' in stockResult) return { ok: false, error: stockResult.error }

  const priceDelta = sanitizeDecimalOrNull(input.priceDelta)
  const priceOverride = sanitizeDecimalOrNull(input.priceOverride)
  const pricingError = validateVariantPricing(priceDelta, priceOverride)
  if (pricingError) return { ok: false, error: pricingError }

  const sku = sanitizeOptionalString(input.sku)

  if (!hasDatabase || !prisma?.productVariant) {
    const db = readDB()
    if (sku) {
      const dup = (db.productVariants || []).find(
        v => v.productId === productId && (v.sku || '').toLowerCase() === sku.toLowerCase()
      )
      if (dup) return { ok: false, error: 'Já existe uma variação com este SKU para este produto.' }
    }
    const now = new Date().toISOString()
    const record: ProductVariantRecord = {
      id: `var_${Date.now()}`,
      productId,
      name,
      sku: sku ?? null,
      color: sanitizeOptionalString(input.color) ?? null,
      size: sanitizeOptionalString(input.size) ?? null,
      material: sanitizeOptionalString(input.material) ?? null,
      finish: sanitizeOptionalString(input.finish) ?? null,
      priceDelta: priceDelta ?? null,
      priceOverride: priceOverride ?? null,
      stockQuantity: stockResult.value,
      isAvailable: input.isAvailable !== false,
      createdAt: now,
      updatedAt: now,
    }
    db.productVariants = [...(db.productVariants || []), record]
    writeDB(db)
    return { ok: true, variant: serializeVariant(record) }
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!product) return { ok: false, error: 'Produto não encontrado.' }

    if (sku) {
      const dup = await prisma.productVariant.findFirst({
        where: { productId, sku: { equals: sku, mode: 'insensitive' } },
        select: { id: true },
      })
      if (dup) return { ok: false, error: 'Já existe uma variação com este SKU para este produto.' }
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name,
        sku: sku ?? null,
        color: sanitizeOptionalString(input.color) ?? null,
        size: sanitizeOptionalString(input.size) ?? null,
        material: sanitizeOptionalString(input.material) ?? null,
        finish: sanitizeOptionalString(input.finish) ?? null,
        priceDelta: priceDelta ?? null,
        priceOverride: priceOverride ?? null,
        stockQuantity: stockResult.value,
        isAvailable: input.isAvailable !== false,
      },
    })
    return { ok: true, variant: serializeVariant(variant) }
  } catch (error) {
    reportDbError('createProductVariant Prisma failed', error)
    return { ok: false, error: 'Erro ao criar variação.' }
  }
}

export async function updateProductVariant(
  productId: string,
  variantId: string,
  input: ProductVariantInput
): Promise<{ ok: boolean; variant?: ProductVariantDto; error?: string }> {
  const nameProvided = input.name !== undefined
  let name: string | undefined
  if (nameProvided) {
    const trimmed = sanitizeOptionalString(input.name)
    if (!trimmed) return { ok: false, error: 'name não pode ser vazio.' }
    name = trimmed
  }

  let stockValue: number | undefined
  if (input.stockQuantity !== undefined) {
    const stockResult = validateVariantStock(input.stockQuantity)
    if ('error' in stockResult) return { ok: false, error: stockResult.error }
    stockValue = stockResult.value
  }

  const priceDelta = sanitizeDecimalOrNull(input.priceDelta)
  const priceOverride = sanitizeDecimalOrNull(input.priceOverride)
  const pricingError = validateVariantPricing(priceDelta, priceOverride)
  if (pricingError) return { ok: false, error: pricingError }

  const sku = input.sku !== undefined ? sanitizeOptionalString(input.sku) : undefined

  if (!hasDatabase || !prisma?.productVariant) {
    const db = readDB()
    const list = db.productVariants || []
    const idx = list.findIndex(v => v.id === variantId && v.productId === productId)
    if (idx === -1) return { ok: false, error: 'Variação não encontrada.' }
    if (sku && sku !== list[idx].sku) {
      const dup = list.find(
        v =>
          v.productId === productId &&
          v.id !== variantId &&
          (v.sku || '').toLowerCase() === sku.toLowerCase()
      )
      if (dup) return { ok: false, error: 'Já existe uma variação com este SKU para este produto.' }
    }
    const updated: ProductVariantRecord = {
      ...list[idx],
      ...(name !== undefined ? { name } : {}),
      ...(input.color !== undefined ? { color: sanitizeOptionalString(input.color) ?? null } : {}),
      ...(input.size !== undefined ? { size: sanitizeOptionalString(input.size) ?? null } : {}),
      ...(input.material !== undefined ? { material: sanitizeOptionalString(input.material) ?? null } : {}),
      ...(input.finish !== undefined ? { finish: sanitizeOptionalString(input.finish) ?? null } : {}),
      ...(sku !== undefined ? { sku: sku ?? null } : {}),
      ...(input.priceDelta !== undefined ? { priceDelta: priceDelta ?? null } : {}),
      ...(input.priceOverride !== undefined ? { priceOverride: priceOverride ?? null } : {}),
      ...(stockValue !== undefined ? { stockQuantity: stockValue } : {}),
      ...(input.isAvailable !== undefined ? { isAvailable: !!input.isAvailable } : {}),
      updatedAt: new Date().toISOString(),
    }
    list[idx] = updated
    db.productVariants = list
    writeDB(db)
    return { ok: true, variant: serializeVariant(updated) }
  }

  try {
    const existing = await prisma.productVariant.findFirst({ where: { id: variantId, productId } })
    if (!existing) return { ok: false, error: 'Variação não encontrada.' }

    if (sku && sku !== existing.sku) {
      const dup = await prisma.productVariant.findFirst({
        where: { productId, sku: { equals: sku, mode: 'insensitive' }, NOT: { id: variantId } },
        select: { id: true },
      })
      if (dup) return { ok: false, error: 'Já existe uma variação com este SKU para este produto.' }
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(input.color !== undefined ? { color: sanitizeOptionalString(input.color) ?? null } : {}),
        ...(input.size !== undefined ? { size: sanitizeOptionalString(input.size) ?? null } : {}),
        ...(input.material !== undefined ? { material: sanitizeOptionalString(input.material) ?? null } : {}),
        ...(input.finish !== undefined ? { finish: sanitizeOptionalString(input.finish) ?? null } : {}),
        ...(sku !== undefined ? { sku: sku ?? null } : {}),
        ...(input.priceDelta !== undefined ? { priceDelta: priceDelta ?? null } : {}),
        ...(input.priceOverride !== undefined ? { priceOverride: priceOverride ?? null } : {}),
        ...(stockValue !== undefined ? { stockQuantity: stockValue } : {}),
        ...(input.isAvailable !== undefined ? { isAvailable: !!input.isAvailable } : {}),
      },
    })
    dispatchRestockNotificationsIfNeeded(productId, variantId).catch(() => {})
    return { ok: true, variant: serializeVariant(updated) }
  } catch (error) {
    reportDbError('updateProductVariant Prisma failed', error)
    return { ok: false, error: 'Erro ao atualizar variação.' }
  }
}

export async function deleteProductVariant(
  productId: string,
  variantId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!hasDatabase || !prisma?.productVariant) {
    const db = readDB()
    const list = db.productVariants || []
    const idx = list.findIndex(v => v.id === variantId && v.productId === productId)
    if (idx === -1) return { ok: false, error: 'Variação não encontrada.' }
    list.splice(idx, 1)
    db.productVariants = list
    writeDB(db)
    return { ok: true }
  }

  try {
    const existing = await prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } })
    if (!existing) return { ok: false, error: 'Variação não encontrada.' }
    // Cascade: ProductImage.variantId vira NULL via FK ON DELETE SET NULL.
    // OrderItem.variantId também é SetNull (configurado no schema atual) — preserva histórico.
    await prisma.productVariant.delete({ where: { id: variantId } })
    return { ok: true }
  } catch (error) {
    reportDbError('deleteProductVariant Prisma failed', error)
    return { ok: false, error: 'Erro ao remover variação.' }
  }
}

// ---------------------------------------------------------------------------
// Stock decrement after order creation
// Best-effort: caller must catch failures and not block order completion.
// ---------------------------------------------------------------------------
export async function decrementOrderStock(
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return

  if (!hasDatabase || !prisma?.product) {
    // Local JSON fallback: only product-level stock; variant-level not tracked here.
    const db = readDB()
    let mutated = false
    for (const item of items) {
      if (item.variantId) {
        const variant = db.productVariants.find(v => v.id === item.variantId)
        if (variant) {
          variant.stockQuantity = Math.max(0, (variant.stockQuantity ?? 0) - item.quantity)
          mutated = true
        }
        continue
      }
      const product = db.products.find(p => p.id === item.productId)
      if (product && typeof product.stock === 'number') {
        product.stock = Math.max(0, product.stock - item.quantity)
        mutated = true
      }
    }
    if (mutated) writeDB(db)
    return
  }

  // Prisma path — run inside a transaction for atomicity per call.
  const client = prisma
  await client.$transaction(
    items.map(item => {
      if (item.variantId) {
        return client.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        })
      }
      return client.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

export type WishlistItemDto = {
  id: string
  productId: string
  product: Product | null
  createdAt: string
}

const wishlistClient = (): any => (prisma as any)?.wishlistItem

function readWishlistFromLocalDb(customerId: string): WishlistItemDto[] {
  const db = readDB()
  const items = (db.wishlistItems || []).filter(item => item.customerId === customerId)
  const productsMap = new Map(db.products.map(p => [p.id, p]))
  return items
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(item => ({
      id: item.id,
      productId: item.productId,
      product: productsMap.get(item.productId) || null,
      createdAt: item.createdAt,
    }))
}

export async function listWishlistForCustomer(customerId: string): Promise<WishlistItemDto[]> {
  if (!customerId) return []

  if (!hasDatabase || !wishlistClient()) {
    return readWishlistFromLocalDb(customerId)
  }

  try {
    const records = await wishlistClient().findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    })

    if (records.length === 0) return []

    const productIds: string[] = Array.from(new Set(records.map((r: any) => String(r.productId))))
    const products = await prisma!.product.findMany({
      where: { id: { in: productIds } },
      include: { images: true, categories: true },
    })
    const productMap = new Map(products.map(p => [p.id, serializeProduct(p)]))

    return records.map((r: any) => ({
      id: r.id,
      productId: r.productId,
      product: productMap.get(r.productId) || null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }))
  } catch (error) {
    reportDbError('listWishlistForCustomer Prisma failed, using fallback', error)
    return readWishlistFromLocalDb(customerId)
  }
}

export async function listWishlistProductIds(customerId: string): Promise<string[]> {
  if (!customerId) return []

  if (!hasDatabase || !wishlistClient()) {
    const db = readDB()
    return (db.wishlistItems || []).filter(item => item.customerId === customerId).map(item => item.productId)
  }

  try {
    const records = await wishlistClient().findMany({
      where: { customerId },
      select: { productId: true },
    })
    return records.map((r: any) => r.productId)
  } catch (error) {
    reportDbError('listWishlistProductIds Prisma failed', error)
    return []
  }
}

export async function addToWishlist(
  customerId: string,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!customerId || !productId) return { ok: false, error: 'invalid_input' }

  if (!hasDatabase || !wishlistClient()) {
    const db = readDB()
    const product = db.products.find(p => p.id === productId)
    if (!product) return { ok: false, error: 'product_not_found' }
    db.wishlistItems = db.wishlistItems || []
    const exists = db.wishlistItems.find(
      item => item.customerId === customerId && item.productId === productId,
    )
    if (!exists) {
      db.wishlistItems.unshift({
        id: `wishlist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        customerId,
        productId,
        createdAt: new Date().toISOString(),
      })
      writeDB(db)
    }
    return { ok: true }
  }

  try {
    const product = await prisma!.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!product) return { ok: false, error: 'product_not_found' }

    await wishlistClient().upsert({
      where: { customerId_productId: { customerId, productId } },
      update: {},
      create: { customerId, productId },
    })
    return { ok: true }
  } catch (error) {
    reportDbError('addToWishlist Prisma failed', error)
    return { ok: false, error: 'persist_failed' }
  }
}

// ---------------------------------------------------------------------------
// Restock alerts ("avise quando voltar")
// ---------------------------------------------------------------------------

const restockClient = (): any => (prisma as any)?.restockAlert

export type RestockAlertSubscription = {
  email: string
  productId: string
  variantId?: string | null
}

export async function subscribeToRestock(input: RestockAlertSubscription): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.productId) return { ok: false, error: 'invalid_input' }

  if (!hasDatabase || !restockClient()) {
    const db = readDB()
    db.restockAlerts = db.restockAlerts || []
    const exists = db.restockAlerts.find(
      a => a.email === email && a.productId === input.productId && (a.variantId || null) === (input.variantId || null) && !a.notifiedAt,
    )
    if (!exists) {
      db.restockAlerts.unshift({
        id: `restock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email,
        productId: input.productId,
        variantId: input.variantId || null,
        notifiedAt: null,
        createdAt: new Date().toISOString(),
      })
      writeDB(db)
    }
    return { ok: true }
  }

  try {
    await restockClient().upsert({
      where: {
        email_productId_variantId: {
          email,
          productId: input.productId,
          variantId: input.variantId || null,
        },
      },
      update: { notifiedAt: null }, // re-arm if previously notified
      create: { email, productId: input.productId, variantId: input.variantId || null },
    })
    return { ok: true }
  } catch (error) {
    reportDbError('subscribeToRestock Prisma failed', error)
    return { ok: false, error: 'persist_failed' }
  }
}

export type PendingRestockAlert = {
  id: string
  email: string
  productId: string
  variantId: string | null
}

export async function listPendingRestockAlertsForProduct(
  productId: string,
  variantId?: string | null,
): Promise<PendingRestockAlert[]> {
  if (!productId) return []

  if (!hasDatabase || !restockClient()) {
    const db = readDB()
    return (db.restockAlerts || [])
      .filter(a => a.productId === productId && (a.variantId || null) === (variantId || null) && !a.notifiedAt)
      .map(a => ({ id: a.id, email: a.email, productId: a.productId, variantId: a.variantId || null }))
  }

  try {
    const records = await restockClient().findMany({
      where: { productId, variantId: variantId || null, notifiedAt: null },
      select: { id: true, email: true, productId: true, variantId: true },
    })
    return records as PendingRestockAlert[]
  } catch (error) {
    reportDbError('listPendingRestockAlertsForProduct Prisma failed', error)
    return []
  }
}

async function dispatchRestockEmails(
  alerts: PendingRestockAlert[],
  productName: string,
  productSlug: string,
): Promise<void> {
  if (alerts.length === 0) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  // Lazy import to keep email config out of the database module's import graph in tests.
  const { sendRestockAlertEmail } = await import('@/lib/email')

  const sent: string[] = []
  for (const alert of alerts) {
    const ok = await sendRestockAlertEmail(alert.email, productName, productSlug, appUrl).catch(() => false)
    if (ok) sent.push(alert.id)
  }

  if (sent.length > 0) await markRestockAlertsNotified(sent)
}

export async function dispatchRestockNotificationsIfNeeded(
  productId: string,
  variantId?: string | null,
): Promise<void> {
  if (!productId) return

  if (!hasDatabase || !prisma?.product || !restockClient()) return

  try {
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { stockQuantity: true, isAvailable: true, productId: true, product: { select: { name: true, slug: true } } },
      })
      if (!variant) return
      if (!variant.isAvailable || variant.stockQuantity <= 0) return

      const alerts = await listPendingRestockAlertsForProduct(productId, variantId)
      await dispatchRestockEmails(alerts, variant.product.name, variant.product.slug)
      return
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, slug: true, stock: true, underOrder: true, isActive: true, status: true },
    })
    if (!product || !product.isActive || product.status === 'draft') return
    const available = product.stock > 0 || product.underOrder
    if (!available) return

    const alerts = await listPendingRestockAlertsForProduct(productId, null)
    await dispatchRestockEmails(alerts, product.name, product.slug)
  } catch (error) {
    reportDbError('dispatchRestockNotificationsIfNeeded failed', error)
  }
}

export async function markRestockAlertsNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  if (!hasDatabase || !restockClient()) {
    const db = readDB()
    const now = new Date().toISOString()
    db.restockAlerts = (db.restockAlerts || []).map(a =>
      ids.includes(a.id) ? { ...a, notifiedAt: now } : a,
    )
    writeDB(db)
    return
  }

  try {
    await restockClient().updateMany({
      where: { id: { in: ids } },
      data: { notifiedAt: new Date() },
    })
  } catch (error) {
    reportDbError('markRestockAlertsNotified Prisma failed', error)
  }
}

// ---------------------------------------------------------------------------
// Admin dashboard metrics
// ---------------------------------------------------------------------------

export type AdminDashboardMetrics = {
  todayPaidCount: number
  todayPaidRevenue: number
  monthPaidCount: number
  monthPaidRevenue: number
  monthAverageTicket: number
  pendingProduction: number
  readyToShip: number
  topProductThisMonth: { name: string; quantity: number; revenue: number } | null
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date: Date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const now = new Date()
  const today = startOfDay(now)
  const monthStart = startOfMonth(now)

  if (!hasDatabase || !prisma?.order) {
    const orders = readDB().orders
    const paid = orders.filter(o => o.paymentStatus === 'paid')
    const todayPaid = paid.filter(o => new Date(o.createdAt) >= today)
    const monthPaid = paid.filter(o => new Date(o.createdAt) >= monthStart)
    const monthRevenue = monthPaid.reduce((sum, o) => sum + (o.total || 0), 0)
    const todayRevenue = todayPaid.reduce((sum, o) => sum + (o.total || 0), 0)

    const productAgg = new Map<string, { quantity: number; revenue: number }>()
    for (const order of monthPaid) {
      for (const item of order.items || []) {
        const key = item.productName || 'Produto'
        const cur = productAgg.get(key) || { quantity: 0, revenue: 0 }
        cur.quantity += item.quantity
        cur.revenue += item.unitPrice * item.quantity
        productAgg.set(key, cur)
      }
    }
    const top = Array.from(productAgg.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity)[0] || null

    return {
      todayPaidCount: todayPaid.length,
      todayPaidRevenue: todayRevenue,
      monthPaidCount: monthPaid.length,
      monthPaidRevenue: monthRevenue,
      monthAverageTicket: monthPaid.length ? monthRevenue / monthPaid.length : 0,
      pendingProduction: orders.filter(o => o.fulfillmentStatus === 'pending' || o.fulfillmentStatus === 'in_production').length,
      readyToShip: orders.filter(o => o.fulfillmentStatus === 'ready_to_ship').length,
      topProductThisMonth: top,
    }
  }

  try {
    const [todayAgg, monthAgg, fulfillmentCounts, monthItems] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: 'paid', createdAt: { gte: today } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: 'paid', createdAt: { gte: monthStart } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['fulfillmentStatus'],
        where: { paymentStatus: 'paid' },
        _count: { _all: true },
      }),
      prisma.orderItem.findMany({
        where: {
          order: { paymentStatus: 'paid', createdAt: { gte: monthStart } },
        },
        select: {
          productNameSnapshot: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      }),
    ])

    const productAgg = new Map<string, { quantity: number; revenue: number }>()
    for (const item of monthItems) {
      const name = item.productNameSnapshot || 'Produto'
      const cur = productAgg.get(name) || { quantity: 0, revenue: 0 }
      cur.quantity += item.quantity
      cur.revenue += Number(item.total ?? Number(item.unitPrice) * item.quantity)
      productAgg.set(name, cur)
    }
    const top = Array.from(productAgg.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity)[0] || null

    const fulfillmentMap = new Map<string, number>()
    for (const row of fulfillmentCounts) {
      fulfillmentMap.set(row.fulfillmentStatus, row._count._all)
    }

    const monthCount = monthAgg._count._all
    const monthRevenue = Number(monthAgg._sum.total ?? 0)

    return {
      todayPaidCount: todayAgg._count._all,
      todayPaidRevenue: Number(todayAgg._sum.total ?? 0),
      monthPaidCount: monthCount,
      monthPaidRevenue: monthRevenue,
      monthAverageTicket: monthCount ? monthRevenue / monthCount : 0,
      pendingProduction: (fulfillmentMap.get('pending') || 0) + (fulfillmentMap.get('in_production') || 0),
      readyToShip: fulfillmentMap.get('ready_to_ship') || 0,
      topProductThisMonth: top,
    }
  } catch (error) {
    reportDbError('getAdminDashboardMetrics Prisma failed', error)
    return {
      todayPaidCount: 0,
      todayPaidRevenue: 0,
      monthPaidCount: 0,
      monthPaidRevenue: 0,
      monthAverageTicket: 0,
      pendingProduction: 0,
      readyToShip: 0,
      topProductThisMonth: null,
    }
  }
}

export async function removeFromWishlist(
  customerId: string,
  productId: string,
): Promise<{ ok: boolean }> {
  if (!customerId || !productId) return { ok: false }

  if (!hasDatabase || !wishlistClient()) {
    const db = readDB()
    const before = (db.wishlistItems || []).length
    db.wishlistItems = (db.wishlistItems || []).filter(
      item => !(item.customerId === customerId && item.productId === productId),
    )
    if (db.wishlistItems.length !== before) writeDB(db)
    return { ok: true }
  }

  try {
    await wishlistClient().deleteMany({ where: { customerId, productId } })
    return { ok: true }
  } catch (error) {
    reportDbError('removeFromWishlist Prisma failed', error)
    return { ok: false }
  }
}
