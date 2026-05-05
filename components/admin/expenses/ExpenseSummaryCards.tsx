'use client'

type Summary = {
  totalAmount: string
  paidAmount: string
  pendingAmount: string
  overdueAmount: string
}

type Props = {
  summary: Summary | null
  isLoading?: boolean
}

function formatBRL(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function SummaryCard({
  label,
  value,
  accent,
  isLoading,
}: {
  label: string
  value: string
  accent: string
  isLoading: boolean
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '14px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        borderTop: `3px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#6B7494', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      {isLoading ? (
        <div style={{ height: '32px', width: '120px', background: '#E3E9F4', borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: accent, fontFamily: 'var(--font-mono)' }}>
          {value}
        </p>
      )}
    </div>
  )
}

export function ExpenseSummaryCards({ summary, isLoading = false }: Props) {
  const cards = [
    {
      label: 'Total Pago',
      value: summary ? formatBRL(summary.paidAmount) : 'R$ 0,00',
      accent: '#1D7A72',
    },
    {
      label: 'Total Pendente',
      value: summary ? formatBRL(summary.pendingAmount) : 'R$ 0,00',
      accent: '#92400E',
    },
    {
      label: 'Total Vencido',
      value: summary ? formatBRL(summary.overdueAmount) : 'R$ 0,00',
      accent: '#B42318',
    },
    {
      label: 'Total Geral',
      value: summary ? formatBRL(summary.totalAmount) : 'R$ 0,00',
      accent: '#1D2235',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} isLoading={isLoading} />
      ))}
    </div>
  )
}
