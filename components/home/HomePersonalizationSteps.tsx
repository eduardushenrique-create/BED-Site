// Seção "Como funciona a personalização" — server component, sem JS no
// cliente. Layout 3 colunas em desktop, 1 coluna em mobile, com numeração
// grande para guiar o olhar.

import Link from 'next/link'
import Button from '@/components/Button'

type Step = {
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    title: 'Escolha o produto',
    description:
      'Navegue pelo catálogo e selecione o que combina com você.',
  },
  {
    title: 'Personalize',
    description:
      'Adicione nome, data ou cor especial. Cada detalhe importa.',
  },
  {
    title: 'Receba em casa',
    description:
      'Imprimimos sob demanda e enviamos pra todo Brasil.',
  },
]

export default function HomePersonalizationSteps() {
  return (
    <section
      aria-labelledby="home-personalization-steps-title"
      style={{ marginBottom: '64px' }}
    >
      <h2
        id="home-personalization-steps-title"
        style={{
          fontSize: '32px',
          fontWeight: 600,
          marginBottom: '32px',
          textAlign: 'center',
          color: '#1D2235',
        }}
      >
        Como funciona a personalização
      </h2>

      <ol
        className="home-personalization-steps-grid"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            style={{
              background: 'white',
              borderRadius: '14px',
              padding: '24px',
              boxShadow:
                '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontSize: '48px',
                fontWeight: 700,
                lineHeight: 1,
                color: '#4A7AB5',
                fontFamily: 'inherit',
              }}
            >
              {index + 1}
            </span>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 600,
                margin: 0,
                color: '#1D2235',
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                margin: 0,
                color: '#3D4460',
                fontSize: '14px',
                lineHeight: 1.55,
              }}
            >
              {step.description}
            </p>
          </li>
        ))}
      </ol>

      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <Link href="/produtos">
          <Button variant="outline">Começar a personalizar</Button>
        </Link>
      </div>
    </section>
  )
}
