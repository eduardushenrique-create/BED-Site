interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'new' | 'sale'
  style?: React.CSSProperties
}

const variantStyles: Record<Required<BadgeProps>['variant'], string> = {
  default: 'background-color: #EEF1F8; color: #3D4460;',
  success: 'background-color: #DFF2EC; color: #2E7D6E;',
  warning: 'background-color: #F7E6EB; color: #A3526A;',
  new: 'background-color: #1D2235; color: white;',
  sale: 'background-color: #D4849A; color: white;',
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
        ...parseStyles(variantStyles[variant]),
        ...style,
      }}
    >
      {children}
    </span>
  )
}

function parseStyles(styleString: string): React.CSSProperties {
  const style: Record<string, string> = {}
  styleString.split(';').forEach(part => {
    const [key, value] = part.split(':').map(s => s.trim())
    if (key && value) {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      style[cssKey] = value
    }
  })
  return style as React.CSSProperties
}
