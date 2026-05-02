import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

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
  const year = new Date().getFullYear()

  return (
    <footer
      style={{
        backgroundColor: '#1D2235',
        color: 'white',
        padding: '56px 0 32px',
        marginTop: 'auto',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
            marginBottom: '48px',
          }}
        >
          <div>
            <div style={{ marginBottom: '16px' }}>
              <BrandLogo dark={false} size="lg" />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: '14px', lineHeight: 1.7, maxWidth: '280px' }}>
              Presentes únicos, impressos em 3D com cuidado artesanal. Personalize e surpreenda em cada detalhe.
            </p>
          </div>

          <div>
            <h4
              style={{
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: '16px',
                color: 'rgba(255,255,255,0.42)',
              }}
            >
              Produtos
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {footerLinks.produtos.map(link => (
                <li key={link.href} style={{ marginBottom: '8px' }}>
                  <Link href={link.href} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4
              style={{
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: '16px',
                color: 'rgba(255,255,255,0.42)',
              }}
            >
              Institucional
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {footerLinks.institucional.map(link => (
                <li key={link.href} style={{ marginBottom: '8px' }}>
                  <Link href={link.href} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4
              style={{
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: '16px',
                color: 'rgba(255,255,255,0.42)',
              }}
            >
              Legal
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {footerLinks.legal.map(link => (
                <li key={link.href} style={{ marginBottom: '8px' }}>
                  <Link href={link.href} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.12)',
            paddingTop: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: '14px' }}>© {year} B&D Artes & Impressões. Todos os direitos reservados.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a
              href="https://www.instagram.com/beddesings/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @beddesings (abre em nova aba)"
              className="icon-btn"
              style={{ display: 'inline-flex' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.5" aria-hidden="true" focusable="false">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="18" cy="6" r="1.5" fill="rgba(255,255,255,0.78)" />
              </svg>
            </a>
            <a
              href="https://wa.me/5511978871566"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp +55 11 97887-1566 (abre em nova aba)"
              className="icon-btn"
              style={{ display: 'inline-flex' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.5" aria-hidden="true" focusable="false">
                <path d="M17.5 6.5c-2.5 0-4.5 2-4.5 4.5 0 1.5.5 3 1.5 4l-1 3 3-1c1.5 1 3 1.5 4.5 1.5 2.5 0 4.5-2 4.5-4.5s-2-4.5-4.5-4.5z" />
                <path d="M12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
