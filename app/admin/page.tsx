import Link from 'next/link'
import { getAdminDashboardMetrics } from '@/lib/database'
import { generateExpenseReport, currentMonthRange } from '@/lib/expenseReports'

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
    href: '/admin/clientes',
    title: 'Clientes',
    description: 'Lista de compradores e cadastros.',
    cta: 'Ver clientes →',
    accent: '#A36A1F',
  },
  {
    href: '/admin/produtos',
    title: 'Produtos',
    description: 'Gerencie catálogo, fotos e personalizações.',
    cta: 'Ver produtos →',
    accent: '#1D7A72',
  },
  {
    href: '/admin/componentes',
    title: 'Componentes',
    description: 'Gerencie insumos, estoque e alertas de baixa.',
    cta: 'Ver componentes →',
    accent: '#B42318',
  },
  {
    href: '/admin/filamentos',
    title: 'Filamentos',
    description: 'Cadastre filamentos, cores e consumo por impressora.',
    cta: 'Ver filamentos →',
    accent: '#4A7AB5',
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
    href: '/admin/despesas',
    title: 'Despesas',
    description: 'Registre e acompanhe despesas operacionais, insumos e custos fixos.',
    cta: 'Ver despesas →',
    accent: '#B42318',
  },
  {
    href: '/admin/avaliacoes',
    title: 'Avaliações',
    description: 'Modere as avaliações dos clientes antes de publicar.',
    cta: 'Ver avaliações →',
    accent: '#F59E0B',
  },
  {
    href: '/admin/emails',
    title: 'E-mails',
    description: 'Campanhas, templates e descadastros.',
    cta: 'Ver e-mails →',
    accent: '#6B7494',
  },
  {
    href: '/admin/auditoria',
    title: 'Auditoria',
    description: 'Log de ações sensíveis (estornos, exclusões, alterações).',
    cta: 'Ver auditoria →',
    accent: '#6B7494',
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

function formatExpenseBRL(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export default async function AdminIndexPage() {
  const metrics = await getAdminDashboardMetrics()

  // Fetch expense report for the current month — silently suppressed on failure
  let expenseReport: Awaited<ReturnType<typeof generateExpenseReport>> | null = null
  try {
    const { startDate, endDate } = currentMonthRange('America/Sao_Paulo')
    expenseReport = await generateExpenseReport(startDate, endDate)
  } catch {
    // Non-critical — dashboard still renders without expense data
  }

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
          {expenseReport && (
            <KpiCard
              label={`Despesas em ${monthName}`}
              value={formatExpenseBRL(
                String(
                  parseFloat(expenseReport.totals.paid) +
                    parseFloat(expenseReport.totals.pending),
                ),
              )}
              hint="Pagas + pendentes"
              accent="#B42318"
            />
          )}
          {expenseReport && (
            <KpiCard
              label="Lucro estimado"
              value={formatBRL(
                Math.max(
                  0,
                  metrics.monthPaidRevenue - parseFloat(expenseReport.totals.paid),
                ),
              )}
              hint="Receita paga − despesas pagas"
              accent="#1D7A72"
            />
          )}
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
