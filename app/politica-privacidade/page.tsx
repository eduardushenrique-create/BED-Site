export default function PrivacyPage() {
  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '24px' }}>
        Política de privacidade
      </h1>
      
      <div style={{ maxWidth: '700px', color: '#78716C', lineHeight: 1.8 }}>
        <p style={{ marginBottom: '24px' }}>
          Esta política de privacidade descreve como coletamos, usamos e protegemos suas informações pessoais.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Dados que coletamos
        </h2>
        <p style={{ marginBottom: '16px' }}>
          Coletamos dados necessários para processar seu pedido: nome, e-mail, telefone, CPF e endereço de entrega.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Como usamos seus dados
        </h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
          <li>Processar e entregar seu pedido</li>
          <li>Enviar confirmações e atualizações sobre seu pedido</li>
          <li>Comunicar promoções e novidades (apenas se você consentir)</li>
        </ul>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Proteção de dados
        </h2>
        <p style={{ marginBottom: '16px' }}>
          Seus dados são armazenados de forma segura e nunca são vendidos ou compartilhados com terceiros.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Contato
        </h2>
        <p>
          Dúvidas sobre esta política? Entre em contato pelo e-mail contato@forma3d.com.br
        </p>
      </div>
    </main>
  )
}