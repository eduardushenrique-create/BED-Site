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
    <main className="container" style={{ paddingTop: '32px', paddingBottom: '64px' }}>
      <Banner />

      <section style={{ textAlign: 'center', marginBottom: '96px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '16px' }}>
          Presentes feitos para durar.
        </h1>
        <p style={{ fontSize: '18px', color: '#78716C', maxWidth: '600px', margin: '0 auto 32px' }}>
          Objetos personalizados impressos em 3D. Criamos presentes únicos e memoráveis para você dar às pessoas que ama.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/produtos">
            <Button>Ver produtos</Button>
          </Link>
          <Link href="/personalizados">
            <Button variant="outline">Personalizar</Button>
          </Link>
        </div>
      </section>

      <section style={{ marginBottom: '64px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center' }}>
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
                boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)',
              }}
            >
              <span style={{ fontWeight: 500, color: '#1C1917' }}>{cat}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '32px', textAlign: 'center' }}>
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
          <p style={{ textAlign: 'center', color: '#78716C' }}>
            Marque produtos como destaque no admin para exibi-los aqui.
          </p>
        )}
      </section>
    </main>
  )
}