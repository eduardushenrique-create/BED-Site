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
          <label style={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#1C1917',
          }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          style={{
            padding: '12px 16px',
            borderRadius: '4px',
            border: error ? '1px solid #C8552A' : '1px solid #E8E2DA',
            fontSize: '16px',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
            backgroundColor: 'white',
            ...style,
          }}
          {...props}
        />
        {error && (
          <span style={{ fontSize: '14px', color: '#C8552A' }}>{error}</span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input