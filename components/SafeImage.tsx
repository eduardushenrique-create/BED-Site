'use client'

import { useState } from 'react'

type Props = {
  src?: string | null
  alt: string
  className?: string
  style?: React.CSSProperties
}

export default function SafeImage({ src, alt, className, style }: Props) {
  const [broken, setBroken] = useState(false)
  const hasSrc = Boolean(src && src.length > 0)

  if (!hasSrc || broken) {
    return (
      <div
        aria-label={alt}
        role="img"
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8AAFD8',
          background: '#E4EDF8',
          ...style,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    )
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src!}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={className}
      style={style}
    />
  )
}
