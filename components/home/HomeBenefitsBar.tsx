// Faixa de reasons-to-believe exibida logo abaixo do banner principal.
// Server component puro: sem JS no cliente, sem state. SVGs inline em stroke
// (estilo lucide) para ficar leve e combinar com o resto da home.

type Benefit = {
  title: string
  // Cada SVG é renderizado dentro de um <span aria-hidden>; o aria-label do
  // benefício mora no item da lista.
  icon: React.ReactNode
}

const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const BENEFITS: Benefit[] = [
  {
    title: 'Envio para todo o Brasil',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 7h11v9H3z" />
        <path d="M14 10h4l3 3v3h-7" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </svg>
    ),
  },
  {
    title: 'Parcele em até 12x',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
    ),
  },
  {
    title: 'Produtos personalizáveis',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    ),
  },
  {
    title: 'Filamento PLA sustentável',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3c4 4 6 7 6 11a6 6 0 1 1-12 0c0-4 2-7 6-11z" />
        <path d="M12 21v-7" />
      </svg>
    ),
  },
]

export default function HomeBenefitsBar() {
  return (
    <section
      aria-label="Por que comprar com a B&D Design"
      style={{
        marginBottom: '64px',
        background: 'white',
        borderRadius: '14px',
        padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
      }}
    >
      <ul
        role="list"
        className="home-benefits-grid"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {BENEFITS.map((benefit) => (
          <li
            key={benefit.title}
            role="listitem"
            aria-label={benefit.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#1D2235',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: '#4A7AB5',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#F0F5FB',
                flexShrink: 0,
              }}
            >
              {benefit.icon}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.35 }}>
              {benefit.title}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
