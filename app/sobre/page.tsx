export default function AboutPage() {
  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <div
        style={{
          background: 'white',
          borderRadius: '18px',
          padding: 'clamp(24px, 4vw, 48px)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 46px)', fontWeight: 700, marginBottom: '24px', color: '#1D2235' }}>
          Sobre nós
        </h1>

        <div style={{ maxWidth: '720px' }}>
          <p style={{ fontSize: '18px', lineHeight: 1.7, marginBottom: '24px', color: '#6B7494' }}>
            Somos a <strong style={{ color: '#1D2235' }}>B&amp;D Artes &amp; Impressões</strong>, uma marca brasileira dedicada a criar presentes únicos e personalizados por meio da impressão 3D.
          </p>

          <p style={{ lineHeight: 1.7, marginBottom: '24px', color: '#6B7494' }}>
            Nascemos da vontade de transformar afeto em objeto. Em vez de escolher algo genérico, você pode criar uma peça exclusiva, com nome, data, mensagem e acabamento pensados para a ocasião.
          </p>

          <p style={{ lineHeight: 1.7, marginBottom: '24px', color: '#6B7494' }}>
            Cada peça é impressa sob demanda, com materiais de qualidade e acabamento cuidadoso. Trabalhamos com uma estética limpa, artesanal e contemporânea, sempre com foco em presentes que realmente marcam.
          </p>

          <h2 style={{ fontSize: '24px', fontWeight: 600, marginTop: '48px', marginBottom: '16px', color: '#1D2235' }}>
            Nossa tecnologia
          </h2>
          <p style={{ lineHeight: 1.7, color: '#6B7494' }}>
            Usamos impressão 3D para criar objetos com formas precisas, produção sob demanda e liberdade de personalização. Cada item passa por revisão manual antes de seguir para entrega.
          </p>
        </div>
      </div>
    </main>
  )
}
