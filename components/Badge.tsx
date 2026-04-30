interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'new' | 'sale'
  style?: React.CSSProperties
}

const variantStyles: Record<Required<BadgeProps>['variant'], string> = {
  default: 'background-color: #E8E2DA; color: #1C1917;',
  success: 'background-color: #1D7A72; color: white;',
  warning: 'background-color: #C8552A; color: white;',
  new: 'background-color: #1D7A72; color: white;',
  sale: 'background-color: #C8552A; color: white;',
}

export default function Badge({ children, variant = 'default', style }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'lowercase',
      ...parseStyles(variantStyles[variant]),
      ...style,
    }}>
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