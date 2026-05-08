import Link from 'next/link'
import { getAdminDashboardMetrics } from '@/lib/database'
import { generateExpenseReport, currentMonthRange } from '@/lib/expenseReports'

export const dynamic = 'force-dynamic'

interface DashboardCard {
  href: string
  title: string
  description: string
  accent: string
  icon: string
}

const cards: DashboardCard[] = [
  {
    href: '/admin/pedidos',
    title: 'Pedidos',
    description: 'Pagamentos, fulfillment e criação manual.',
    accent: '#1D2235',
    icon: '📦',
  },
  {
    href: '/admin/producao',
    title: 'Produção',
    description: 'Itens sob encomenda, impressões e riscos de atraso.',
    accent: '#2A4F8A',
    icon: '⚙️',
  },
  {
    href: '/admin/impressoras',
    title: 'Impressoras',
    description: 'Máquinas, capacidade e tarefas por impressora.',
    accent: '#0EA5E9',
    icon: '🖨️',
  },
  {
    href: '/admin/clientes',
    title: 'Clientes',
    description: 'Lista de compradores e cadastros.',
    accent: '#A36A1F',
    icon: '👤',
  },
  {
    href: '/admin/produtos',
    title: 'Produtos',
    description: 'Catálogo, fotos e personalizações.',
    accent: '#1D7A72',
    icon: '🏷️',
  },
  {
    href: '/admin/componentes',
    title: 'Componentes',
    description: 'Insumos, estoque e alertas de baixa.',
    accent: '#B42318',
    icon: '🔩',
  },
  {
    href: '/admin/filamentos',
    title: 'Filamentos',
    description: 'Cores e consumo por impressora.',
    accent: '#4A7AB5',
    icon: '🧵',
  },
  {
    href: '/admin/categorias',
    title: 'Categorias',
    description: 'Organize a vitrine da loja.',
    accent: '#9A4F1A',
    icon: '📂',
  },
  {
    href: '/admin/banners',
    title: 'Banners',
    description: 'Promoções e destaques na home.',
    accent: '#A3526A',
    icon: '🖼️',
  },
  {
    href: '/admin/cupons',
    title: 'Cupons',
    description: 'Descontos do checkout.',
    accent: '#1D7A72',
    icon: '🎟️',
  },
  {
    href: '/admin/despesas',
    title: 'Despesas',
    description: 'Despesas operacionais, insumos e custos fixos.',
    accent: '#B42318',
    icon: '💰',
  },
  {
    href: '/admin/avaliacoes',
    title: 'Avaliações',
    description: 'Modere avaliações antes de publicar.',
    accent: '#F59E0B',
    icon: '⭐',
  },
  {
    href: '/admin/emails',
    title: 'E-mails',
    description: 'Campanhas, templates e descadastros.',
    accent: '#6B7494',
    icon: '✉️',
  },
  {
    href: '/admin/auditoria',
    title: 'Auditoria',
    description: 'Log de estornos, exclusões e alterações sensíveis.',
    accent: '#6B7494',
    icon: '🔍',
  },
]

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatExpenseBRL(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent: string
}) {
  return (
    <div
      className="admin-kpi-card"
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(29,34,53,0.07)',
        borderTop: `3px solid ${accent}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 18,
          right: 20,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: accent,
          opacity: 0.45,
          display: 'block',
        }}
      />
      <p
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#9AA1B8',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '30px',
          fontWeight: 700,
          color: '#1D2235',
          margin: '10px 0 6px',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: '12px', color: '#9AA1B8', margin: 0 }}>{hint}</p>
      )}
    </div>
  )
}

export default async function AdminIndexPage() {
  const metrics = await getAdminDashboardMetrics()

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
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        style={{
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: '1px solid #E3E9F4',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#9AA1B8',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              margin: '0 0 4px',
            }}
          >
            Admin B&D
          </p>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 700,
              color: '#1D2235',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Painel
          </h1>
        </div>
        <span
          style={{
            fontSize: '12px',
            color: '#9AA1B8',
            fontFamily: 'var(--font-mono)',
          }}
        >
          apenas pedidos pagos
        </span>
      </header>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '36px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
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
            hint={metrics.monthPaidCount ? 'Por pedido pago' : 'Sem pedidos no mês'}
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

        {/* Top produto */}
        {metrics.topProductThisMonth && (
          <div
            style={{
              marginTop: '14px',
              padding: '14px 20px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 4px rgba(29,34,53,0.06)',
              borderLeft: '3px solid #4A7AB5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#4A7AB5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                🏆 Top produto do mês
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#1D2235' }}>
                {metrics.topProductThisMonth.name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ color: '#9AA1B8', fontSize: '12px' }}>
                {metrics.topProductThisMonth.quantity}{' '}
                {metrics.topProductThisMonth.quantity === 1 ? 'unidade' : 'unidades'}
              </span>
              <span style={{ color: '#1D2235', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '15px' }}>
                {formatBRL(metrics.topProductThisMonth.revenue)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Áreas ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#9AA1B8',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            margin: 0,
          }}
        >
          Áreas
        </h2>
        <span style={{ fontSize: '11px', color: '#C5CDE0' }}>
          {cards.length} seções
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="admin-area-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 1px 4px rgba(29,34,53,0.06)',
              textDecoration: 'none',
              color: '#1D2235',
              borderTop: `3px solid ${card.accent}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              minHeight: '130px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '26px', lineHeight: 1 }}>{card.icon}</span>
              <span
                style={{
                  fontSize: '18px',
                  color: card.accent,
                  opacity: 0.35,
                  lineHeight: 1,
                  fontWeight: 300,
                }}
              >
                →
              </span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1D2235', lineHeight: 1.2, marginBottom: '6px' }}>
              {card.title}
            </span>
            <span style={{ fontSize: '12px', color: '#9AA1B8', flex: 1, lineHeight: 1.5 }}>
              {card.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
