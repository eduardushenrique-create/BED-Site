interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'new' | 'sale'
  style?: React.CSSProperties
}

const variantStyles: Record<Required<BadgeProps>['variant'], React.CSSProperties> = {
  default: { backgroundColor: '#EEF1F8', color: '#3D4460' },
  success: { backgroundColor: '#DFF2EC', color: '#2E7D6E' },
  warning: { backgroundColor: '#F7E6EB', color: '#A3526A' },
  new: { backgroundColor: '#1D2235', color: 'white' },
  sale: { backgroundColor: '#D4849A', color: 'white' },
}

export default function Badge({ children, variant = 'default', style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
