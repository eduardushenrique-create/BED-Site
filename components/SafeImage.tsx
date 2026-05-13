'use client'

import Image from 'next/image'
import { useState } from 'react'

type Props = {
  src?: string | null
  alt: string
  className?: string
  style?: React.CSSProperties
  /** sizes hint para o `next/image` em modo `fill`. Default cobre os layouts atuais (cards/galeria). */
  sizes?: string
  /** marca como prioritária — usar só na imagem hero acima da dobra. */
  priority?: boolean
  /** loading hint para imagens abaixo da dobra (default: lazy). */
  loading?: 'eager' | 'lazy'
}

const DEFAULT_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'

export default function SafeImage({ src, alt, className, style, sizes, priority, loading }: Props) {
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

  // Data URLs (legado do storage inline) não passam pelo otimizador do
  // next/image — caem no <img> direto pra não quebrar produtos antigos. Novos
  // uploads vão pro Vercel Blob como https e ganham o otimizador.
  if (src!.startsWith('data:')) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src!}
        alt={alt}
        width={800}
        height={600}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
      />
    )
  }

  // URLs remotas: wrapper relative + Image fill. Todos os call sites já
  // encapsulam num container com aspect-ratio ou width/height fixos, então
  // herdar 100%/100% mantém o comportamento atual.
  const objectFit = (style?.objectFit as React.CSSProperties['objectFit']) || 'cover'
  return (
    <span
      className={className}
      style={{
        ...style,
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
        width: style?.width ?? '100%',
        height: style?.height ?? '100%',
      }}
    >
      <Image
        src={src!}
        alt={alt}
        fill
        sizes={sizes || DEFAULT_SIZES}
        priority={priority}
        loading={priority ? undefined : loading}
        onError={() => setBroken(true)}
        style={{ objectFit }}
      />
    </span>
  )
}
