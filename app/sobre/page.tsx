export default function AboutPage() {
  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '24px' }}>
        Sobre nós
      </h1>
      
      <div style={{ maxWidth: '700px' }}>
        <p style={{ fontSize: '18px', lineHeight: 1.6, marginBottom: '24px', color: '#78716C' }}>
          Somos a <strong>Forma 3D</strong>, uma marca brasileira dedicada a criar presentes únicos e personalizados através da tecnologia de impressão 3D.
        </p>
        
        <p style={{ lineHeight: 1.6, marginBottom: '24px', color: '#78716C' }}>
          Nacemos da ideia de oferecer presentes que realmente significam algo. Em vez de comprar algo genérico, você pode criar um objeto exclusivo, com a sua mensagem, seu design, seu estilo.
        </p>
        
        <p style={{ lineHeight: 1.6, marginBottom: '24px', color: '#78716C' }}>
          Cada peça é impressa sob demanda, com materiais de qualidade e acabamento cuidadoso. Priorizamos a sustentabilidade — impressão sob demanda significa零estoque excedente e menos desperdício.
        </p>

        <h2 style={{ fontSize: '24px', fontWeight: 600, marginTop: '48px', marginBottom: '16px' }}>
          Nossa tecnologia
        </h2>
        <p style={{ lineHeight: 1.6, color: '#78716C' }}>
          Usamos impressão 3D FDM e resinapara criar objetos com detalhes precisos e acabamentos diversos. Cada peça é inspecionada manualmente antes de ser enviada.
        </p>
      </div>
    </main>
  )
}