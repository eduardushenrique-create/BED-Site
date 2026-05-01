import Link from 'next/link'

interface DashboardCard {
  href: string
  title: string
  description: string
  cta: string
  accent: string
}

const cards: DashboardCard[] = [
  {
    href: '/admin/pedidos',
    title: 'Pedidos',
    description: 'Acompanhe pagamentos, fulfillment e crie pedidos manualmente.',
    cta: 'Ver pedidos →',
    accent: '#1D2235',
  },
  {
    href: '/admin/producao',
    title: 'Produção',
    description: 'Acompanhe itens sob encomenda, quantidades impressas e riscos de atraso.',
    cta: 'Ver produção →',
    accent: '#2A4F8A',
  },
  {
    href: '/admin/produtos',
    title: 'Produtos',
    description: 'Gerencie catálogo, fotos e personalizações.',
    cta: 'Ver produtos →',
    accent: '#1D7A72',
  },
  {
    href: '/admin/clientes',
    title: 'Clientes',
    description: 'Lista de compradores e cadastros.',
    cta: 'Ver clientes →',
    accent: '#A36A1F',
  },
  {
    href: '/admin/categorias',
    title: 'Categorias',
    description: 'Organize a vitrine.',
    cta: 'Ver categorias →',
    accent: '#9A4F1A',
  },
  {
    href: '/admin/banners',
    title: 'Banners',
    description: 'Promoções e destaques na home.',
    cta: 'Ver banners →',
    accent: '#A3526A',
  },
  {
    href: '/admin/cupons',
    title: 'Cupons',
    description: 'Crie e gerencie cupons de desconto do checkout.',
    cta: 'Ver cupons →',
    accent: '#1D7A72',
  },
]

export default function AdminIndexPage() {
  return (
    <div>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235', margin: 0 }}>Painel B&D</h1>
        <p style={{ color: '#6B7494', marginTop: '6px' }}>
          Selecione uma área para começar.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
        }}
      >
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 8px 24px rgba(29,34,53,0.06)',
              textDecoration: 'none',
              color: '#1D2235',
              borderTop: `4px solid ${card.accent}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '18px', fontWeight: 700 }}>{card.title}</span>
            <span style={{ fontSize: '14px', color: '#6B7494', flex: 1 }}>{card.description}</span>
            <span style={{ fontSize: '14px', color: card.accent, fontWeight: 700 }}>{card.cta}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
