'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'background-color: #C8552A; color: white; border: none;',
  secondary: 'background-color: #1D7A72; color: white; border: none;',
  outline: 'background-color: transparent; color: #1C1917; border: 1px solid #E8E2DA;',
  ghost: 'background-color: transparent; color: #1C1917; border: none;',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'padding: 8px 16px; font-size: 14px;',
  md: 'padding: 12px 24px; font-size: 16px;',
  lg: 'padding: 16px 32px; font-size: 18px;',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, style, children, ...props }, ref) => {
    const baseStyle = `
      font-family: var(--font-body);
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `

    const hoverStyle = variant === 'primary' 
      ? '&:hover { background-color: #B44A23; }' 
      : variant === 'secondary'
      ? '&:hover { background-color: #16685F; }'
      : variant === 'outline'
      ? '&:hover { border-color: #78716C; }'
      : '&:hover { background-color: #E8E2DA; }'

    const activeStyle = '&:active { transform: scale(0.97); }'
    const widthStyle = fullWidth ? 'width: 100%;' : ''

    return (
      <button
        ref={ref}
        style={{
          ...parseStyles(baseStyle + variantStyles[variant] + sizeStyles[size] + widthStyle),
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

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

export default Button