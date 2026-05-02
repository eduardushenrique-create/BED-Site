import Link from 'next/link'
import { getAdminDashboardMetrics } from '@/lib/database'

export const dynamic = 'force-dynamic'

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
    href: '/admin/impressoras',
    title: 'Impressoras',
    description: 'Cadastre máquinas, capacidade e status. Atribua tarefas por impressora.',
    cta: 'Ver impressoras →',
    accent: '#0EA5E9',
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
  {
    href: '/admin/auditoria',
    title: 'Auditoria',
    description: 'Log de ações sensíveis (estornos, exclusões, alterações).',
    cta: 'Ver auditoria →',
    accent: '#6B7494',
  },
  {
    href: '/admin/avaliacoes',
    title: 'Avaliações',
    description: 'Modere as avaliações dos clientes antes de publicar.',
    cta: 'Ver avaliações →',
    accent: '#F59E0B',
  },
]

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#6B7494', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: '26px', fontWeight: 700, color: '#1D2235', margin: '8px 0 4px', fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
      {hint && <p style={{ fontSize: '13px', color: '#6B7494', margin: 0 }}>{hint}</p>}
    </div>
  )
}

export default async function AdminIndexPage() {
  const metrics = await getAdminDashboardMetrics()

  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <div>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235', margin: 0 }}>Painel B&D</h1>
        <p style={{ color: '#6B7494', marginTop: '6px' }}>
          Visão geral em tempo real (apenas pedidos pagos).
        </p>
      </header>

      <section style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          <KpiCard
            label="Vendas hoje"
            value={formatBRL(metrics.todayPaidRevenue)}
            hint={`${metrics.todayPaidCount} ${metrics.todayPaidCount === 1 ? 'pedido' : 'pedidos'}`}
            accent="#1D7A72"
          />
          <KpiCard
            label={`Vendas em ${monthName}`}
            value={formatBRL(metrics.monthPaidRevenue)}
            hint={`${metrics.monthPaidCount} ${metrics.monthPaidCount === 1 ? 'pedido' : 'pedidos'}`}
            accent="#2A4F8A"
          />
          <KpiCard
            label="Ticket médio (mês)"
            value={formatBRL(metrics.monthAverageTicket)}
            hint={metrics.monthPaidCount ? 'Por pedido pago' : 'Sem pedidos no mês ainda'}
            accent="#A36A1F"
          />
          <KpiCard
            label="Em produção / pendentes"
            value={String(metrics.pendingProduction)}
            hint={`${metrics.readyToShip} prontos para envio`}
            accent="#A3526A"
          />
        </div>

        {metrics.topProductThisMonth && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px 20px',
              background: '#F0F5FB',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#4A7AB5', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Top produto do mês
              </p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: '#1D2235', margin: '4px 0 0' }}>
                {metrics.topProductThisMonth.name}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, color: '#6B7494', fontSize: '13px' }}>
                {metrics.topProductThisMonth.quantity} {metrics.topProductThisMonth.quantity === 1 ? 'unidade vendida' : 'unidades vendidas'}
              </p>
              <p style={{ margin: '2px 0 0', color: '#1D2235', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {formatBRL(metrics.topProductThisMonth.revenue)}
              </p>
            </div>
          </div>
        )}
      </section>

      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1D2235', margin: '0 0 16px' }}>Áreas</h2>

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
