'use client'

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'var(--color-accent-blue)',
    color: 'var(--color-dark)',
    border: 'none',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--color-dark)',
    border: '1px solid var(--color-neutral-light)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--color-dark)',
    border: 'none',
  },
}

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '14px' },
  md: { padding: '12px 24px', fontSize: '16px' },
  lg: { padding: '16px 32px', fontSize: '18px' },
}

const baseStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  borderRadius: '10px',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, style, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        style={{
          ...baseStyle,
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...(fullWidth ? { width: '100%' } : {}),
          ...(disabled ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
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

export default Button
