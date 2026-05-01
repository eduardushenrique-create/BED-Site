'use client'

export type ProductionTaskStatus =
  | 'pending'
  | 'in_production'
  | 'paused'
  | 'completed'
  | 'cancelled'

interface ProductionStatusBadgeProps {
  status: ProductionTaskStatus | string
  size?: 'sm' | 'md'
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#E7EDF8', color: '#6B7494', label: 'Pendente' },
  in_production: { bg: '#E0EAFB', color: '#2A4F8A', label: 'Em produção' },
  paused: { bg: '#FCEBD9', color: '#A36A1F', label: 'Pausada' },
  completed: { bg: '#DFF4EC', color: '#1D7A72', label: 'Concluída' },
  cancelled: { bg: '#F1E5E9', color: '#A3526A', label: 'Cancelada' },
}

export default function ProductionStatusBadge({ status, size = 'md' }: ProductionStatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending
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
      {style.label}
    </span>
  )
}

const PRIORITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  low: { bg: '#E7EDF8', color: '#6B7494', label: 'Baixa' },
  normal: { bg: '#F0F5FB', color: '#3D4460', label: 'Normal' },
  high: { bg: '#FCEBD9', color: '#A36A1F', label: 'Alta' },
  urgent: { bg: '#F1E5E9', color: '#A3526A', label: 'Urgente' },
}

export function ProductionPriorityBadge({
  priority,
  size = 'md',
}: {
  priority: string
  size?: 'sm' | 'md'
}) {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal
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
      {style.label}
    </span>
  )
}
