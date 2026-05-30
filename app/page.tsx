import Link from 'next/link'
import Button from '@/components/Button'
import Banner from '@/components/Banner'
import ProductCard from '@/components/ProductCard'
import HomeBenefitsBar from '@/components/home/HomeBenefitsBar'
import HomePersonalizationSteps from '@/components/home/HomePersonalizationSteps'
import HomeCustomProjectCTA from '@/components/home/HomeCustomProjectCTA'
import { getLocalCatalogProducts, getPublicCatalogCategories } from '@/lib/catalog'
import { listBanners } from '@/lib/database'
import { listFeaturedApprovedReviews } from '@/lib/reviews'
import { safeJsonLd } from '@/lib/safe-json-ld'

// ISR: regenera estática a cada 60s. Como toda a leitura passa por Prisma
// puro (sem cookies/headers nesta página), trocamos o force-dynamic por
// revalidate=60. Se algum dia entrarmos em rota de cookies/auth aqui, voltar
// para força dinâmica.
export const revalidate = 60

type ProductCardProduct = Parameters<typeof ProductCard>[0]['product']

type HomeCategory = {
  id: string
  slug: string
  name: string
  icon: React.ReactNode
}

// Categorias exibidas quando o banco ainda não retornou nada público (sem
// produtos cadastrados, sem ativos visíveis ou Prisma indisponível). Mantém a
// home navegável e leva o visitante para listagens reais via querystring; se
// a categoria não tiver produtos, a página de produtos já lida graciosamente.
const FALLBACK_CATEGORY_ICON_PROPS = {
  width: 32,
  height: 32,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const FALLBACK_CATEGORIES: HomeCategory[] = [
  {
    id: 'fallback-decoracao',
    slug: 'decoracao',
    name: 'Decoração',
    icon: (
      <svg {...FALLBACK_CATEGORY_ICON_PROPS}>
        <path d="M3 11 12 3l9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    ),
  },
  {
    id: 'fallback-cozinha',
    slug: 'cozinha',
    name: 'Cozinha',
    icon: (
      <svg {...FALLBACK_CATEGORY_ICON_PROPS}>
        <path d="M6 3v8a3 3 0 0 0 6 0V3" />
        <path d="M9 11v10" />
        <path d="M17 3a3 3 0 0 0-3 3v6h3" />
        <path d="M17 12v9" />
      </svg>
    ),
  },
  {
    id: 'fallback-escritorio',
    slug: 'escritorio',
    name: 'Escritório',
    icon: (
      <svg {...FALLBACK_CATEGORY_ICON_PROPS}>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 9h6" />
        <path d="M7 13h4" />
      </svg>
    ),
  },
  {
    id: 'fallback-geek-pop',
    slug: 'geek-pop',
    name: 'Geek & Pop',
    icon: (
      <svg {...FALLBACK_CATEGORY_ICON_PROPS}>
        <path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5L12 15.6 7 18.2l1-5.5-4-3.9 5.5-.8z" />
      </svg>
    ),
  },
  {
    id: 'fallback-acessorios',
    slug: 'acessorios',
    name: 'Acessórios',
    icon: (
      <svg {...FALLBACK_CATEGORY_ICON_PROPS}>
        <path d="M6 8h12l-1 12H7z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
]

export default async function Home() {
  const [products, categories, allBanners, featuredReviews, giftProductsRaw] = await Promise.all([
    getLocalCatalogProducts({ featured: true }),
    getPublicCatalogCategories(),
    listBanners(),
    listFeaturedApprovedReviews(6).catch(() => []),
    getLocalCatalogProducts({ maxPrice: 30 }).catch(() => []),
  ])
  const activeBanners = allBanners.filter(b => b.isActive)
  const allProducts = (Array.isArray(products) ? products : []).filter(Boolean) as ProductCardProduct[]
  const featuredProducts = allProducts.slice(0, 4)
  const giftProducts = ((Array.isArray(giftProductsRaw) ? giftProductsRaw : []).filter(
    Boolean,
  ) as ProductCardProduct[]).slice(0, 4)

  // Quando o banco não devolve categorias públicas, mostramos um conjunto fixo
  // de atalhos para que a home não fique vazia nem com mensagem técnica. O
  // aviso vai pro log do servidor, fora da UI pública.
  const usingFallbackCategories = categories.length === 0
  if (usingFallbackCategories) {
    console.warn('[home] no public categories returned')
  }
  const displayCategories: HomeCategory[] = usingFallbackCategories
    ? FALLBACK_CATEGORIES
    : categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        icon: null,
      }))

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
  // Lista as categorias visíveis (reais ou fallback) como ItemList para o
  // Google entender a navegação principal da home. Usa o mesmo conjunto que
  // a UI exibe — assim o que o crawler vê bate com o que o usuário clica.
  const categoriesItemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Categorias da loja',
    itemListElement: displayCategories.map((category, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: category.name,
      url: appUrl
        ? `${appUrl.replace(/\/$/, '')}/produtos?categoria=${category.slug}`
        : `/produtos?categoria=${category.slug}`,
    })),
  }

  return (
    <main className="container" style={{ paddingTop: '20px', paddingBottom: '64px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(categoriesItemListJsonLd) }} />
      <Banner banners={activeBanners.length > 0 ? activeBanners : undefined} />

      <HomeBenefitsBar />

      <section style={{ marginBottom: '64px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center', color: '#1D2235' }}>
          Categorias
        </h2>
        <div className="home-categories-grid">
          {displayCategories.map((category) => (
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
                gap: '12px',
              }}
            >
              {category.icon && (
                <span aria-hidden="true" style={{ color: '#4A7AB5', display: 'inline-flex' }}>
                  {category.icon}
                </span>
              )}
              <span style={{ fontWeight: 500 }}>{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '64px' }}>
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

      <HomePersonalizationSteps />

      {giftProducts.length > 0 && (
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center', color: '#1D2235' }}>
            Lembrancinhas até R$ 30
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            {giftProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <Link href="/produtos">
              <Button variant="outline">Ver mais opções</Button>
            </Link>
          </div>
        </section>
      )}

      {featuredReviews.length > 0 && (
        <section style={{ marginBottom: '64px' }}>
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

      <HomeCustomProjectCTA />
    </main>
  )
}
