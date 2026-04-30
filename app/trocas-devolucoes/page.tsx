export default function ExchangesPage() {
  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '24px' }}>
        Trocas e devoluções
      </h1>
      
      <div style={{ maxWidth: '700px', color: '#78716C', lineHeight: 1.8 }}>
        <p style={{ marginBottom: '24px' }}>
          Wantemos garantir sua satisfação com cada compra. Leia abaixo nossa política de trocas e devoluções.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Prazo para solicitação
        </h2>
        <p style={{ marginBottom: '16px' }}>
          Você pode solicitar troca ou devolução em até <strong>7 dias corridos</strong> após o recebimento do produto.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Condições para devolução
        </h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
          <li>Produto deve estar sem uso e na embalagem original</li>
          <li>Todos os acessórios e manuais devem estar inclusos</li>
          <li>Produto não pode apresentar danos causados pelo uso</li>
        </ul>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Produtos personalizados
        </h2>
        <p style={{ marginBottom: '16px' }}>
          <strong>Produtos personalizados não podem ser trocados ou devolvidos</strong>, pois são produzidos especialmente para você conforme sua especificação.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Como solicitar
        </h2>
        <p style={{ marginBottom: '16px' }}>
          Entre em contato pelo WhatsApp ou e-mail informando seu número de pedido e o motivo da troca/devolução. Nossa equipe orientará os próximos passos.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Reembolso
        </h2>
        <p style={{ marginBottom: '16px' }}>
          Após recebermos o produto e verificarmos as condições, o reembolso será processado em até <strong>10 dias úteis</strong> pelo mesmo método de pagamento utilizado na compra.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1C1917', marginTop: '32px', marginBottom: '12px' }}>
          Troca por outro produto
        </h2>
        <p style={{ marginBottom: '16px' }}>
          Você pode solicitar a troca por outro produto do catálogo. Havendo diferença de valor, será cobrada ou reembolsada a diferença.
        </p>

        <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#FFF5F2', borderRadius: '8px' }}>
          <p style={{ fontWeight: 500, marginBottom: '8px', color: '#C8552A' }}>
            Precisa de ajuda?
          </p>
          <p style={{ marginBottom: '0' }}>
            Entre em contato pelo WhatsApp ou e-mail para solicitar sua troca ou devolução.
          </p>
        </div>
      </div>
    </main>
  )
}