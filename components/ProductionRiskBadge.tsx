'use client'

export type ProductionRiskLevel =
  | 'on_track'
  | 'attention'
  | 'at_risk'
  | 'overdue'
  | 'completed'

interface ProductionRiskBadgeProps {
  level: ProductionRiskLevel | string
  label?: string
  size?: 'sm' | 'md'
}

const RISK_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  on_track: { bg: '#DFF4EC', color: '#1D7A72', label: 'Dentro do prazo' },
  attention: { bg: '#FCEBD9', color: '#A36A1F', label: 'Atenção' },
  at_risk: { bg: '#F5D9C7', color: '#9A4F1A', label: 'Em risco' },
  overdue: { bg: '#F1E5E9', color: '#A3526A', label: 'Atrasado' },
  completed: { bg: '#E5E5F4', color: '#4A4F8A', label: 'Concluído' },
}

export default function ProductionRiskBadge({ level, label, size = 'md' }: ProductionRiskBadgeProps) {
  const style = RISK_STYLES[level] || RISK_STYLES.on_track
  const text = label || style.label
  const padding = size === 'sm' ? '3px 10px' : '4px 12px'
  const fontSize = size === 'sm' ? '11px' : '12px'

  return (
    <span
      style={{
        display: 'inline-block',
        padding,
        borderRadius: '999px',
        fontSize,
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}
