'use client'

import { InputHTMLAttributes, forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, style, id, ...props }, ref) => {
    const autoId = useId()
    const inputId = id || autoId
    const errorId = `${inputId}-error`
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {label && (
          <label
            htmlFor={inputId}
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
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className="ui-input"
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            border: error ? '1px solid #D4849A' : '1px solid #D8DCE8',
            fontSize: '16px',
            fontFamily: 'var(--font-body)',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            backgroundColor: 'white',
            color: 'var(--color-dark)',
            ...style,
          }}
          {...props}
        />
        {error && (
          <span id={errorId} role="alert" style={{ fontSize: '14px', color: '#A3526A' }}>
            {error}
          </span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
