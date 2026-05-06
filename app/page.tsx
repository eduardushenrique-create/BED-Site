import Link from 'next/link'
import Button from '@/components/Button'
import Banner from '@/components/Banner'
import ProductCard from '@/components/ProductCard'
import { getLocalCatalogProducts, getPublicCatalogCategories } from '@/lib/catalog'
import { listBanners } from '@/lib/database'
import { listFeaturedApprovedReviews } from '@/lib/reviews'

export const dynamic = 'force-dynamic'

type ProductCardProduct = Parameters<typeof ProductCard>[0]['product']

// Fallback estatico para a home quando o banco nao retorna categorias publicas
// (DB vazio, sem produtos publicados, ou erro de query). Cada slug aqui DEVE
// existir como filtro valido em /produtos?categoria=<slug> — a pagina de
// produtos faz match best-effort por nome/slug, entao o link nunca quebra.
type HomeCategoryCard = {
  id: string
  name: string
  slug: string
  description: string | null
}

const FALLBACK_HOME_CATEGORIES: HomeCategoryCard[] = [
  { id: 'fallback-decoracao', name: 'Decoração', slug: 'decoracao', description: null },
  { id: 'fallback-cozinha', name: 'Cozinha', slug: 'cozinha', description: null },
  { id: 'fallback-escritorio', name: 'Escritório', slug: 'escritorio', description: null },
  { id: 'fallback-geek-pop', name: 'Geek & Pop', slug: 'geek-pop', description: null },
  { id: 'fallback-acessorios', name: 'Acessórios', slug: 'acessorios', description: null },
]

export default async function Home() {
  const [products, categoriesRaw, allBanners, featuredReviews] = await Promise.all([
    getLocalCatalogProducts({ featured: true }),
    getPublicCatalogCategories(),
    listBanners(),
    listFeaturedApprovedReviews(6).catch(() => []),
  ])
  const activeBanners = allBanners.filter(b => b.isActive)
  const allProducts = (Array.isArray(products) ? products : []).filter(Boolean) as ProductCardProduct[]
  const featuredProducts = allProducts.slice(0, 4)

  // Se o catalogo publico nao retornou categorias, mostra o fallback canonico.
  // Isso evita que a home fique com um vazio confuso quando o admin ainda nao
  // publicou produtos em categorias ativas (ex.: setup novo, falha pontual).
  let categories: HomeCategoryCard[] = categoriesRaw
  if (categories.length === 0) {
    console.warn('[home] no public categories returned')
    categories = FALLBACK_HOME_CATEGORIES
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'B&D Artes & Impressões',
    url: appUrl || undefined,
    logo: appUrl ? `${appUrl.replace(/\/$/, '')}/icon.png` : undefined,
    sameAs: ['https://www.instagram.com/beddesings/'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: '+55-11-97887-1566',
        availableLanguage: ['Portuguese'],
      },
    ],
  }
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'B&D Artes & Impressões',
    url: appUrl || undefined,
    potentialAction: {
      '@type': 'SearchAction',
      target: appUrl ? `${appUrl.replace(/\/$/, '')}/produtos?busca={search_term_string}` : undefined,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <main className="container" style={{ paddingTop: '20px', paddingBottom: '64px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <Banner banners={activeBanners.length > 0 ? activeBanners : undefined} />

      <section style={{ marginBottom: '64px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center', color: '#1D2235' }}>
          Categorias
        </h2>
        <div className="home-categories-grid">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/produtos?categoria=${category.slug}`}
              style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)',
                color: '#1D2235',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span aria-hidden="true" style={{ color: '#4A7AB5', fontSize: '18px', lineHeight: 1 }}>
                ▪
              </span>
              <span style={{ fontWeight: 500 }}>{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center', color: '#1D2235' }}>
          Produtos em destaque
        </h2>
        {featuredProducts.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <Link href="/produtos">
                <Button variant="outline">Ver todos os produtos</Button>
              </Link>
            </div>
          </>
        ) : (
          <p style={{ textAlign: 'center', color: '#6B7494' }}>
            Nenhum produto publicado com estoque ou sob encomenda foi encontrado no banco.
          </p>
        )}
      </section>

      {featuredReviews.length > 0 && (
        <section style={{ marginTop: '64px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center', color: '#1D2235' }}>
            O que nossos clientes dizem
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {featuredReviews.map(review => (
              <article
                key={review.id}
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
                }}
              >
                <div aria-label={`${review.rating} de 5 estrelas`} style={{ color: '#F59E0B', letterSpacing: '2px', fontSize: '16px', lineHeight: 1, marginBottom: '8px' }}>
                  {'★'.repeat(review.rating)}<span style={{ color: '#D8DCE8' }}>{'★'.repeat(5 - review.rating)}</span>
                </div>
                {review.title && <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1D2235', margin: '0 0 6px' }}>{review.title}</h3>}
                {review.body && (
                  <p style={{ margin: '0 0 12px', color: '#3D4460', fontSize: '14px', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {review.body}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7494' }}>
                  — {review.customerName}
                  {review.productName && review.productSlug && (
                    <>{' '}sobre{' '}
                      <Link href={`/produtos/${review.productSlug}`} style={{ color: '#4A7AB5', fontWeight: 600 }}>
                        {review.productName}
                      </Link>
                    </>
                  )}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
