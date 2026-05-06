// CTA "Projeto sob medida" — leva direto pro WhatsApp da loja com mensagem
// pré-preenchida. Server component, sem JS no cliente. O número é fixo
// (mesmo já usado em outros pontos do site para contato).

const WHATSAPP_LINK =
  'https://wa.me/5511978871566?text=Ol%C3%A1!%20Tenho%20uma%20ideia%20de%20projeto%20personalizado.'

export default function HomeCustomProjectCTA() {
  return (
    <section
      aria-labelledby="home-custom-project-title"
      style={{
        marginBottom: '64px',
        background: '#1D2235',
        color: 'white',
        borderRadius: '14px',
        padding: '40px 24px',
        textAlign: 'center',
        boxShadow: '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
      }}
    >
      <h2
        id="home-custom-project-title"
        style={{
          fontSize: '28px',
          fontWeight: 700,
          margin: '0 0 12px',
          color: 'white',
        }}
      >
        Tem uma ideia? A gente imprime
      </h2>
      <p
        style={{
          margin: '0 auto 24px',
          maxWidth: '640px',
          fontSize: '15px',
          lineHeight: 1.55,
          color: '#D8DCE8',
        }}
      >
        Encomendas personalizadas, peças sob medida e projetos exclusivos.
        Fale com a gente.
      </p>
      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 24px',
          background: '#4A7AB5',
          color: 'white',
          borderRadius: '10px',
          fontWeight: 600,
          fontSize: '15px',
          textDecoration: 'none',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-12.91 7.09L3 20l1.41-5.09A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
        Falar no WhatsApp
      </a>
    </section>
  )
}
