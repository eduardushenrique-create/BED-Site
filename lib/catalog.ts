import { readDB, Product as LocalProduct } from '@/lib/localDb'
import { Product } from '@/lib/types'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

type CatalogFilters = {
  category?: string
  featured?: boolean
  personalizable?: boolean
  search?: string
}

function serializeLocalProduct(product: LocalProduct): Product {
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
      name: variant.name || 'Padrão',
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

function normalizeMockProduct(product: any): Product {
  const category = product.category
    ? { name: product.category.name, slug: product.category.slug }
    : null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku || null,
    shortDescription: product.shortDescription || null,
    description: product.description || null,
    price: product.price,
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    status: product.status || 'published',
    isActive: product.isActive ?? true,
    isFeatured: product.isFeatured ?? false,
    isPersonalizable: product.isPersonalizable ?? false,
    productionTimeMinDays: product.productionTimeMinDays || 1,
    productionTimeMaxDays: product.productionTimeMaxDays || 3,
    weightGrams: product.weightGrams || 200,
    widthCm: product.widthCm || null,
    heightCm: product.heightCm || null,
    depthCm: product.depthCm || null,
    category,
    images: product.images
      ? product.images.map((img: any) => ({
          id: img.id,
          url: img.url,
          alt: img.alt || null,
          isMain: img.isMain ?? false,
        }))
      : [],
    variants: product.variants
      ? product.variants.map((v: any) => ({
          id: v.id,
          name: v.name || 'Padrão',
          sku: v.sku || null,
          priceDelta: v.priceDelta != null ? Number(v.priceDelta) : null,
        }))
      : [],
    personalizationFields: product.personalizationFields
      ? product.personalizationFields.map((f: any) => ({
          id: f.id,
          label: f.label,
          fieldType: f.fieldType,
          placeholder: f.placeholder || null,
          helpText: f.helpText || null,
          isRequired: f.isRequired ?? false,
          minLength: f.minLength,
          maxLength: f.maxLength,
        }))
      : [],
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
  }
}

export async function getLocalCatalogProducts(filters: CatalogFilters = {}): Promise<Product[]> {
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

  const mockProducts = [
    {
      id: '1',
      name: 'Porta-Retratos Geométrico',
      slug: 'porta-retratos-geometrico',
      sku: 'PRG-001',
      shortDescription: 'Porta-retratos moderno com design geométrico, perfeito para escritório ou sala.',
      description: '<p>Porta-retratos impresso em 3D com design geométrico moderno.</p>',
      price: 89.90,
      compareAtPrice: 119.90,
      status: 'published',
      isActive: true,
      isFeatured: true,
      isPersonalizable: true,
      productionTimeMinDays: 2,
      productionTimeMaxDays: 4,
      weightGrams: 150,
      widthCm: 15,
      heightCm: 20,
      depthCm: 2,
      category: { id: '1', name: 'Decoração', slug: 'decoracao' },
      images: [
        { id: '1', productId: '1', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=800', alt: 'Porta-retratos geométrico', isMain: true },
      ],
      variants: [],
      personalizationFields: [
        { id: 'pf1', label: 'Texto para gravação', fieldType: 'text', placeholder: 'Ex: "Família Silva"', helpText: 'Máximo 30 caracteres', isRequired: true, minLength: 1, maxLength: 30 },
      ],
    },
    {
      id: '2',
      name: 'Suporte para Tablets',
      slug: 'suporte-tablets',
      sku: 'ST-001',
      shortDescription: 'Suporte ajustável para tablets e celulares em múltiplos ângulos.',
      description: '<p>Suporte resistente para tablets e smartphones.</p>',
      price: 59.90,
      compareAtPrice: null,
      status: 'published',
      isActive: true,
      isFeatured: true,
      isPersonalizable: false,
      productionTimeMinDays: 1,
      productionTimeMaxDays: 2,
      weightGrams: 200,
      widthCm: 12,
      heightCm: 10,
      depthCm: 8,
      category: { id: '2', name: 'Escritório', slug: 'escritorio' },
      images: [
        { id: '2', productId: '2', url: 'https://images.unsplash.com/photo-1589254065878-42c9da9e2f58?w=800', alt: 'Suporte para tablets', isMain: true },
      ],
      variants: [
        { id: 'v1', name: 'Preto', sku: 'ST-001-PT', priceDelta: 0 },
        { id: 'v2', name: 'Branco', sku: 'ST-001-BR', priceDelta: 0 },
      ],
      personalizationFields: [],
    },
    {
      id: '3',
      name: 'Organizador de Cozinha',
      slug: 'organizador-cozinha',
      sku: 'OC-001',
      shortDescription: 'Organizador modular para temperos e utensílios pequenos.',
      description: '<p>Conjunto de organizadores modulares para cozinha.</p>',
      price: 79.90,
      compareAtPrice: null,
      status: 'published',
      isActive: true,
      isFeatured: false,
      isPersonalizable: true,
      productionTimeMinDays: 2,
      productionTimeMaxDays: 3,
      weightGrams: 180,
      widthCm: 20,
      heightCm: 8,
      depthCm: 8,
      category: { id: '3', name: 'Cozinha', slug: 'cozinha' },
      images: [
        { id: '3', productId: '3', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', alt: 'Organizador de cozinha', isMain: true },
      ],
      variants: [],
      personalizationFields: [
        { id: 'pf2', label: 'Nome da família', fieldType: 'text', placeholder: 'Ex: Família Oliveira', helpText: null, isRequired: false, minLength: null, maxLength: 25 },
      ],
    },
    {
      id: '4',
      name: 'Porta-retratos Pet',
      slug: 'porta-retratos-pet',
      sku: 'PRP-001',
      shortDescription: 'Porta-retratos especial para fotos dos seus pets com nome gravado.',
      description: '<p>Porta-retratos dedicado aos amigos peludos.</p>',
      price: 69.90,
      compareAtPrice: 89.90,
      status: 'published',
      isActive: true,
      isFeatured: true,
      isPersonalizable: true,
      productionTimeMinDays: 2,
      productionTimeMaxDays: 3,
      weightGrams: 120,
      widthCm: 15,
      heightCm: 15,
      depthCm: 2,
      category: { id: '4', name: 'Pets', slug: 'pets' },
      images: [
        { id: '4', productId: '4', url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800', alt: 'Porta-retratos pet', isMain: true },
      ],
      variants: [],
      personalizationFields: [
        { id: 'pf3', label: 'Nome do pet', fieldType: 'text', placeholder: 'Ex: Thor', helpText: null, isRequired: true, minLength: 1, maxLength: 20 },
      ],
    },
    {
      id: '5',
      name: 'Decoração Minimalista',
      slug: 'decoracao-minimalista',
      sku: 'DM-001',
      shortDescription: 'Conjunto de peças decorativas minimalistas para ambientação.',
      description: '<p>Conjunto de 3 peças decorativas em estilo minimalista.</p>',
      price: 129.90,
      compareAtPrice: null,
      status: 'published',
      isActive: true,
      isFeatured: false,
      isPersonalizable: false,
      productionTimeMinDays: 3,
      productionTimeMaxDays: 5,
      weightGrams: 300,
      widthCm: 10,
      heightCm: 20,
      depthCm: 5,
      category: { id: '1', name: 'Decoração', slug: 'decoracao' },
      images: [
        { id: '5', productId: '5', url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', alt: 'Decoração minimalista', isMain: true },
      ],
      variants: [],
      personalizationFields: [],
    },
  ]

  const catalog = localProducts.length > 0 ? localProducts : mockProducts.map(normalizeMockProduct)
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

export async function getLocalCatalogProductBySlug(slug: string): Promise<Product | null> {
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