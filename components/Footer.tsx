import Link from 'next/link'

const footerLinks = {
  produtos: [
    { href: '/produtos', label: 'Todos os produtos' },
    { href: '/produtos?categoria=decoracao', label: 'Decoração' },
    { href: '/produtos?categoria=cozinha', label: 'Cozinha' },
    { href: '/produtos?categoria=escritorio', label: 'Escritório' },
  ],
  institucional: [
    { href: '/sobre', label: 'Sobre nós' },
    { href: '/contato', label: 'Contato' },
    { href: '/faq', label: 'FAQ' },
  ],
  legal: [
    { href: '/politica-privacidade', label: 'Política de privacidade' },
    { href: '/termos-uso', label: 'Termos de uso' },
    { href: '/trocas-devolucoes', label: 'Trocas e devoluções' },
    { href: '/politica-entrega', label: 'Política de entrega' },
  ],
}

export default function Footer() {
  return (
    <footer style={{
      backgroundColor: '#1C1917',
      color: 'white',
      padding: '64px 0 32px',
      marginTop: 'auto',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '48px',
          marginBottom: '48px',
        }}>
          <div>
            <Link href="/" style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 700,
              color: 'white',
              display: 'block',
              marginBottom: '16px',
            }}>
              Forma 3D
            </Link>
            <p style={{ color: '#A8A29E', fontSize: '14px', lineHeight: 1.6 }}>
              Presentes personalizados impressos em 3D. Criamos objetos únicos e memoráveis.
            </p>
          </div>

          <div>
            <h4 style={{
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '16px',
              color: '#A8A29E',
            }}>
              Produtos
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {footerLinks.produtos.map(link => (
                <li key={link.href} style={{ marginBottom: '8px' }}>
                  <Link href={link.href} style={{ color: 'white', fontSize: '14px' }}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '16px',
              color: '#A8A29E',
            }}>
              Institucional
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {footerLinks.institucional.map(link => (
                <li key={link.href} style={{ marginBottom: '8px' }}>
                  <Link href={link.href} style={{ color: 'white', fontSize: '14px' }}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '16px',
              color: '#A8A29E',
            }}>
              Legal
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {footerLinks.legal.map(link => (
                <li key={link.href} style={{ marginBottom: '8px' }}>
                  <Link href={link.href} style={{ color: 'white', fontSize: '14px' }}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #44403C',
          paddingTop: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}>
          <p style={{ color: '#A8A29E', fontSize: '14px' }}>
            © 2026 Forma 3D. Todos os direitos reservados.
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="18" cy="6" r="1.5" fill="white"/>
              </svg>
            </a>
            <a href="https://wa.me/55" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M17.5 6.5c-2.5 0-4.5 2-4.5 4.5 0 1.5.5 3 1.5 4l-1 3 3-1c1.5 1 3 1.5 4.5 1.5 2.5 0 4.5-2 4.5-4.5s-2-4.5-4.5-4.5z"/>
                <path d="M12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}