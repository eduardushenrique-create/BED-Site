import { notFound } from 'next/navigation'
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
  if (product.categories?.length) jsonLd.category = product.categories.map(c => c.name).join(', ')

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
  return getLocalCatalogProductBySlug(slug)
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
