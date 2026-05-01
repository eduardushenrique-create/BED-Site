import Link from 'next/link'

type BrandLogoProps = {
  href?: string
  dark?: boolean
  iconOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { icon: 36, wordmark: 180, text: 20, sub: 10 },
  md: { icon: 42, wordmark: 200, text: 22, sub: 10 },
  lg: { icon: 48, wordmark: 220, text: 24, sub: 11 },
} as const

export default function BrandLogo({ href = '/', dark = true, iconOnly = false, size = 'md' }: BrandLogoProps) {
  const palette = dark
    ? {
        text: '#1D2235',
        line: 'rgba(29,34,53,0.16)',
        subA: '#6B7494',
        subB: '#4A7AB5',
        top: '#BBCFEB',
        left: '#1D2235',
        right: '#2E3650',
        stroke: 'rgba(255,255,255,0.34)',
      }
    : {
        text: '#F0F5FB',
        line: 'rgba(240,245,251,0.14)',
        subA: 'rgba(240,245,251,0.48)',
        subB: '#BBCFEB',
        top: '#BBCFEB',
        left: '#3D5070',
        right: '#4D6080',
        stroke: 'rgba(255,255,255,0.22)',
      }

  const dimensions = sizeMap[size]

  const content = iconOnly ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="none" width={dimensions.icon} height={dimensions.icon} aria-hidden="true">
      <polygon points="28,4 52,16 28,28 4,16" fill={palette.top} />
      <polygon points="4,16 28,28 28,52 4,40" fill={palette.left} />
      <polygon points="52,16 28,28 28,52 52,40" fill={palette.right} />
      <polyline points="4,16 28,4 52,16" fill="none" stroke={palette.stroke} strokeWidth="1" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 56"
      fill="none"
      width={dimensions.wordmark}
      height={Math.round((dimensions.wordmark / 300) * 56)}
      aria-label="B&D Artes & Impressões"
      role="img"
    >
      <g transform="translate(0,5)">
        <polygon points="26,2 48,13 26,24 4,13" fill={palette.top} />
        <polygon points="4,13 26,24 26,44 4,33" fill={palette.left} />
        <polygon points="48,13 26,24 26,44 48,33" fill={palette.right} />
        <polyline points="4,13 26,2 48,13" fill="none" stroke={palette.stroke} strokeWidth="0.8" />
      </g>
      <text x="60" y="34" fontFamily="'DM Sans','Helvetica Neue',sans-serif" fontWeight="700" fontSize={dimensions.text} letterSpacing="-1" fill={palette.text}>
        B&amp;D
      </text>
      <line x1="116" y1="14" x2="116" y2="40" stroke={palette.line} strokeWidth="1" />
      <text x="126" y="25" fontFamily="'DM Sans','Helvetica Neue',sans-serif" fontWeight="400" fontSize={dimensions.sub} letterSpacing="0.06em" fill={palette.subA}>
        Artes &amp;
      </text>
      <text x="126" y="39" fontFamily="'DM Sans','Helvetica Neue',sans-serif" fontWeight="600" fontSize={dimensions.sub} letterSpacing="0.06em" fill={palette.subB}>
        Impressões
      </text>
    </svg>
  )

  return (
    <Link href={href} aria-label="B&D Artes & Impressões" style={{ display: 'inline-flex', alignItems: 'center' }}>
      {content}
    </Link>
  )
}
