// Server component (sem 'use client'): renderiza estaticamente no SSR e nao
// adiciona JS ao bundle do cliente. Usado entre o Banner e a secao de
// Categorias da home como faixa de trust signals.

type Benefit = {
  label: string
  // SVG inline em estilo stroke (lucide-like). aria-label vem do <li> pai.
  icon: React.ReactNode
}

const STROKE = '#1D2235'
const ICON_PROPS = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: STROKE,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false as const,
}

const BENEFITS: Benefit[] = [
  {
    label: 'Envio para todo o Brasil',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 7h11v8H3z" />
        <path d="M14 10h4l3 3v2h-7" />
        <circle cx="7.5" cy="17" r="1.75" />
        <circle cx="17.5" cy="17" r="1.75" />
      </svg>
    ),
  },
  {
    label: 'Parcele em até 12x',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h3" />
      </svg>
    ),
  },
  {
    label: 'Produtos personalizáveis',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M14.5 4.5l5 5L9 20H4v-5z" />
        <path d="M13 6l5 5" />
      </svg>
    ),
  },
  {
    label: 'Filamento PLA sustentável',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 21c5-3 8-7 8-12a8 8 0 0 0-16 0c0 5 3 9 8 12z" />
        <path d="M12 12c0-3 2-5 5-5" />
      </svg>
    ),
  },
]

export default function HomeBenefitsBar() {
  return (
    <section
      aria-label="Beneficios da loja"
      style={{
        marginBottom: '64px',
        backgroundColor: '#FAFCFE',
        border: '1px solid #D8DCE8',
        borderRadius: '12px',
        padding: '20px 16px',
      }}
    >
      <ul
        className="home-benefits-grid"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: '16px',
        }}
      >
        {BENEFITS.map((benefit) => (
          <li
            key={benefit.label}
            aria-label={benefit.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                backgroundColor: '#BBCFEB',
                color: '#1D2235',
                flexShrink: 0,
              }}
            >
              {benefit.icon}
            </span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#1D2235',
                lineHeight: 1.35,
              }}
            >
              {benefit.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
