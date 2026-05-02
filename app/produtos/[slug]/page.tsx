import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/lib/db'
import { getLocalCatalogProductBySlug } from '@/lib/catalog'
import { Product } from '@/lib/types'
import ProductDetailClient from './ProductDetailClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

function buildProductJsonLd(product: Product, appUrl: string) {
  const productUrl = `${appUrl.replace(/\/$/, '')}/produtos/${product.slug}`
  const mainImage = product.images.find(i => i.isMain) || product.images[0]
  const imageUrl = mainImage?.url
  const stockAvailability =
    product.underOrder || (product.stock ?? 0) > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock'

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description || product.name,
    sku: product.sku || product.id,
    url: productUrl,
    brand: { '@type': 'Brand', name: 'B&D Artes & Impressões' },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'BRL',
      price: product.price.toFixed(2),
      availability: stockAvailability,
      itemCondition: 'https://schema.org/NewCondition',
    },
  }
  if (imageUrl) jsonLd.image = imageUrl
  if (product.category) jsonLd.category = product.category.name

  if (product.averageRating != null && (product.reviewCount ?? 0) > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.averageRating.toFixed(2),
      reviewCount: product.reviewCount,
      bestRating: '5',
      worstRating: '1',
    }
  }

  return jsonLd
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const jsonLd = buildProductJsonLd(product, appUrl)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient product={product} />
    </>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    return { title: 'Produto não encontrado' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const productUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/produtos/${product.slug}` : undefined
  const mainImage = product.images.find(i => i.isMain) || product.images[0]
  const description = product.shortDescription || `Compre ${product.name} personalizado em 3D na B&D Artes & Impressões.`

  return {
    title: `${product.name} - B&D Artes & Impressões`,
    description,
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url: productUrl,
      siteName: 'B&D Artes & Impressões',
      images: mainImage?.url ? [{ url: mainImage.url, alt: mainImage.alt || product.name }] : undefined,
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: mainImage?.url ? [mainImage.url] : undefined,
    },
    alternates: productUrl ? { canonical: productUrl } : undefined,
  }
}
