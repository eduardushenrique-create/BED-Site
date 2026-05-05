type ExpenseStatus = 'pending' | 'paid' | 'canceled' | 'overdue'

type Props = { status: ExpenseStatus }

const statusConfig: Record<ExpenseStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pendente', bg: '#FEF3C7', color: '#92400E' },
  paid: { label: 'Pago', bg: '#DCFCE7', color: '#166534' },
  canceled: { label: 'Cancelado', bg: '#F3F4F6', color: '#6B7494' },
  overdue: { label: 'Vencida', bg: '#FEE2E2', color: '#B42318' },
}

export function ExpenseStatusBadge({ status }: Props) {
  const cfg = statusConfig[status] ?? { label: status, bg: '#F3F4F6', color: '#6B7494' }
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        borderRadius: '999px',
        padding: '3px 10px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}
