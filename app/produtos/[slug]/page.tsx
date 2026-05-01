import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/lib/db'
import { getLocalCatalogProductBySlug } from '@/lib/catalog'
import { Product } from '@/lib/types'
import ProductDetailClient from './ProductDetailClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getProduct(slug: string): Promise<Product | null> {
  const useDatabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (useDatabase) {
    try {
      const product = await getProductBySlug(slug)
      if (product) {
        return {
          ...product,
          price: product.price,
          compareAtPrice: product.compare_at_price,
          shortDescription: product.short_description,
          description: product.description,
          isPersonalizable: product.is_personalizable,
          productionTimeMinDays: product.production_time_min_days,
          productionTimeMaxDays: product.production_time_max_days,
          images: product.images.map(img => ({
            id: img.id,
            url: img.url,
            alt: img.alt,
            isMain: img.is_main,
          })),
          variants: product.variants.map(v => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            priceDelta: v.price_delta,
          })),
          personalizationFields: product.personalization_fields.map(pf => ({
            id: pf.id,
            label: pf.label,
            fieldType: pf.field_type,
            placeholder: pf.placeholder,
            helpText: pf.help_text,
            isRequired: pf.is_required,
            minLength: pf.min_length,
            maxLength: pf.max_length,
          })),
          category: product.category,
        } as Product
      }
    } catch (error) {
      console.error('Error fetching product from database:', error)
    }
  }

  const product = await getLocalCatalogProductBySlug(slug)
  return product
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient product={product} />
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    return { title: 'Produto não encontrado' }
  }

  return {
    title: `${product.name} - B&D Artes & Impressões`,
    description: product.shortDescription || `Compre ${product.name} personalizado`,
  }
}
