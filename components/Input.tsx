'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, style, ...props }, ref) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {label && (
          <label
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-dark)',
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            border: error ? '1px solid #D4849A' : '1px solid #D8DCE8',
            fontSize: '16px',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
            backgroundColor: 'white',
            color: 'var(--color-dark)',
            ...style,
          }}
          {...props}
        />
        {error && <span style={{ fontSize: '14px', color: '#A3526A' }}>{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
