'use client'

export interface ProductionSummary {
  totalOpen: number
  pending: number
  inProduction: number
  paused: number
  atRisk: number
  overdue: number
  completedToday: number
}

interface ProductionSummaryCardsProps {
  summary: ProductionSummary
}

interface Card {
  label: string
  value: number
  accent: string
  bg: string
  description?: string
}

export default function ProductionSummaryCards({ summary }: ProductionSummaryCardsProps) {
  const cards: Card[] = [
    {
      label: 'Pendentes',
      value: summary.pending,
      accent: '#3D4460',
      bg: '#F0F5FB',
      description: 'Aguardando início',
    },
    {
      label: 'Em produção',
      value: summary.inProduction,
      accent: '#2A4F8A',
      bg: '#E0EAFB',
      description: 'Sendo produzidas agora',
    },
    {
      label: 'Em risco',
      value: summary.atRisk,
      accent: '#9A4F1A',
      bg: '#F5D9C7',
      description: 'Estimativa próxima do prazo',
    },
    {
      label: 'Atrasadas',
      value: summary.overdue,
      accent: '#A3526A',
      bg: '#F1E5E9',
      description: 'Já passaram do prazo',
    },
    {
      label: 'Concluídas hoje',
      value: summary.completedToday,
      accent: '#1D7A72',
      bg: '#DFF4EC',
      description: 'Finalizadas neste dia',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 8px 24px rgba(29,34,53,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderTop: `3px solid ${card.accent}`,
          }}
        >
          <span style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {card.label}
          </span>
          <span
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: card.accent,
              lineHeight: 1,
            }}
          >
            {card.value}
          </span>
          {card.description && (
            <span style={{ fontSize: '12px', color: '#6B7494' }}>{card.description}</span>
          )}
        </div>
      ))}
    </div>
  )
}
