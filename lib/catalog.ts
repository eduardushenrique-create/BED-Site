/* eslint-disable @typescript-eslint/no-explicit-any */
import { readDB, Product as LocalProduct } from '@/lib/localDb'
import { mockProducts } from '@/lib/products'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

type CatalogFilters = {
  category?: string
  featured?: boolean
  personalizable?: boolean
  search?: string
}

function serializeLocalProduct(product: LocalProduct) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku || null,
    shortDescription: product.description || null,
    description: product.description || null,
    price: product.price,
    compareAtPrice: null,
    status: product.status,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isPersonalizable: product.isPersonalizable,
    productionTimeMinDays: 1,
    productionTimeMaxDays: product.underOrder ? 7 : 3,
    weightGrams: 200,
    widthCm: 10,
    heightCm: 10,
    depthCm: 10,
    category: product.category
      ? { name: product.category, slug: product.category }
      : null,
    images: product.imageUrl
      ? [{ id: `${product.id}_image`, url: product.imageUrl, alt: product.name, isMain: true }]
      : [],
    variants: [],
    personalizationFields: [],
    createdAt: null,
    updatedAt: null,
  }
}

function serializePrismaProduct(product: any) {
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
    productionTimeMinDays: product.productionTimeMinDays,
    productionTimeMaxDays: product.productionTimeMaxDays,
    weightGrams: product.weightGrams,
    widthCm: product.widthCm ? Number(product.widthCm) : null,
    heightCm: product.heightCm ? Number(product.heightCm) : null,
    depthCm: product.depthCm ? Number(product.depthCm) : null,
    category: product.category,
    images: product.images.map((image: any) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      isMain: image.isMain,
    })),
    variants: product.variants.map((variant: any) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      priceDelta: variant.priceDelta ? Number(variant.priceDelta) : null,
    })),
    personalizationFields: product.personalizationFields.map((field: any) => ({
      id: field.id,
      label: field.label,
      fieldType: field.fieldType,
      placeholder: field.placeholder,
      helpText: field.helpText,
      isRequired: field.isRequired,
      minLength: field.minLength,
      maxLength: field.maxLength,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}

export async function getLocalCatalogProducts(filters: CatalogFilters = {}) {
  if (hasDatabase) {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        status: { not: 'draft' },
        category: filters.category ? { slug: filters.category } : undefined,
        isFeatured: filters.featured ? true : undefined,
        isPersonalizable: filters.personalizable ? true : undefined,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        personalizationFields: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    })

    return products.map(serializePrismaProduct)
  }

  const db = readDB()
  const localProducts = db.products
    .filter(product => product.isActive && product.status !== 'draft')
    .map(serializeLocalProduct)

  const catalog = localProducts.length > 0 ? localProducts : mockProducts
  let products = [...catalog]

  if (filters.category) {
    products = products.filter(product => product.category?.slug === filters.category)
  }

  if (filters.featured) {
    products = products.filter(product => product.isFeatured)
  }

  if (filters.personalizable) {
    products = products.filter(product => product.isPersonalizable)
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    products = products.filter(product =>
      product.name.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower)
    )
  }

  products.sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1
    if (!a.isFeatured && b.isFeatured) return 1
    return a.name.localeCompare(b.name)
  })

  return products
}

export async function getLocalCatalogProductBySlug(slug: string) {
  if (hasDatabase) {
    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        personalizationFields: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return product ? serializePrismaProduct(product) : null
  }

  const products = await getLocalCatalogProducts()
  return products.find(product => product.slug === slug) || null
}
