/* eslint-disable @typescript-eslint/no-explicit-any */
import { Product } from '@/lib/types'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

type CatalogFilters = {
  category?: string
  featured?: boolean
  personalizable?: boolean
  search?: string
}

function serializePrismaProduct(product: any): Product {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription,
    description: product.description,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    status: product.status,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isPersonalizable: product.isPersonalizable,
    stock: product.stock || 0,
    underOrder: product.underOrder || false,
    productionTimeMinDays: product.productionTimeMinDays,
    productionTimeMaxDays: product.productionTimeMaxDays,
    weightGrams: product.weightGrams,
    widthCm: product.widthCm ? Number(product.widthCm) : null,
    heightCm: product.heightCm ? Number(product.heightCm) : null,
    depthCm: product.depthCm ? Number(product.depthCm) : null,
    category: product.category
      ? { name: product.category.name, slug: product.category.slug }
      : null,
    images: product.images.map((image: any) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      isMain: image.isMain,
    })),
    variants: product.variants.map((variant: any) => ({
      id: String(variant.id),
      name: variant.name || 'Padrao',
      sku: variant.sku || null,
      priceDelta: variant.priceDelta ? Number(variant.priceDelta) : null,
    })),
    personalizationFields: product.personalizationFields.map((field: any) => ({
      id: field.id,
      label: field.label,
      fieldType: field.fieldType,
      placeholder: field.placeholder || null,
      helpText: field.helpText || null,
      isRequired: field.isRequired,
      minLength: field.minLength,
      maxLength: field.maxLength,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}

function getPublicProductWhere(filters: CatalogFilters = {}) {
  return {
    isActive: true,
    status: { not: 'draft' },
    category: filters.category ? { slug: filters.category, isActive: true } : undefined,
    isFeatured: filters.featured ? true : undefined,
    isPersonalizable: filters.personalizable ? true : undefined,
    OR: filters.search
      ? [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { description: { contains: filters.search, mode: 'insensitive' as const } },
          { shortDescription: { contains: filters.search, mode: 'insensitive' as const } },
          { sku: { contains: filters.search, mode: 'insensitive' as const } },
          { category: { name: { contains: filters.search, mode: 'insensitive' as const } } },
        ]
      : undefined,
    AND: [
      {
        OR: [
          { stock: { gt: 0 } },
          { underOrder: true },
        ],
      },
    ],
  }
}

export async function getLocalCatalogProducts(filters: CatalogFilters = {}): Promise<Product[]> {
  if (!hasDatabase || !prisma?.product) {
    return []
  }

  try {
    const products = await prisma.product.findMany({
      where: getPublicProductWhere(filters),
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        personalizationFields: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    })

    return products.map(serializePrismaProduct)
  } catch (error) {
    console.error('[catalog] Prisma failed while listing public products:', error)
    return []
  }
}

export async function getPublicCatalogCategories() {
  if (!hasDatabase || !prisma?.category) {
    return []
  }

  try {
    return await prisma.category.findMany({
      where: {
        isActive: true,
        products: {
          some: getPublicProductWhere(),
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    })
  } catch (error) {
    console.error('[catalog] Prisma failed while listing public categories:', error)
    return []
  }
}

export async function getLocalCatalogProductBySlug(slug: string): Promise<Product | null> {
  if (!hasDatabase || !prisma?.product) {
    return null
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        ...getPublicProductWhere(),
        slug,
      },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        personalizationFields: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return product ? serializePrismaProduct(product) : null
  } catch (error) {
    console.error('[catalog] Prisma failed on slug lookup:', error)
    return null
  }
}
