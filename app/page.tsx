import Link from 'next/link'
import Button from '@/components/Button'
import Banner from '@/components/Banner'
import ProductCard from '@/components/ProductCard'
import { getLocalCatalogProducts } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

type ProductCardProduct = Parameters<typeof ProductCard>[0]['product']

export default async function Home() {
  const products = await getLocalCatalogProducts({ featured: true })
  const allProducts = (Array.isArray(products) ? products : []).filter(Boolean) as ProductCardProduct[]
  const featuredProducts = allProducts.slice(0, 4)

  return (
    <main className="container" style={{ paddingTop: '20px', paddingBottom: '64px' }}>
      <Banner />

      <section style={{ marginBottom: '64px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center', color: '#1D2235' }}>
          Categorias
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
          {['Decoração', 'Cozinha', 'Escritório', 'Infantil', 'Pets', 'Casamento', 'Aniversário'].map((cat) => (
            <Link
              key={cat}
              href={`/produtos?categoria=${cat.toLowerCase()}`}
              style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)',
                color: '#1D2235',
              }}
            >
              <span style={{ fontWeight: 500 }}>{cat}</span>
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
          <p style={{ textAlign: 'center', color: '#6B7494' }}>Marque produtos como destaque no admin para exibi-los aqui.</p>
        )}
      </section>
    </main>
  )
}
