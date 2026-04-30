// B&D Artes & Impressões — Footer Component

const BDFooter = () => (
  <footer style={{ background: '#1D2235', color: 'white', padding: '56px 48px 32px', marginTop: 80 }}>
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <img src="../../assets/logo.png" alt="B&D" style={{ height: 42, width: 42, objectFit: 'contain', mixBlendMode: 'luminosity', borderRadius: 8 }} />
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16, color: 'white', lineHeight: 1.1 }}>B&amp;D</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Artes &amp; Impressões</div>
            </div>
          </div>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 260 }}>
            Presentes únicos, impressos em 3D com cuidado. Personalize e surpreenda quem você ama.
          </p>
        </div>

        {/* Links */}
        {[
          { title: 'Loja', links: ['Coleções', 'Personalizados', 'Novidades', 'Promoções'] },
          { title: 'Ajuda', links: ['Como funciona', 'Prazos e entregas', 'Trocas e devoluções', 'FAQ'] },
          { title: 'Empresa', links: ['Sobre nós', 'Blog', 'Contato', 'Instagram'] },
        ].map(col => (
          <div key={col.title}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{col.title}</div>
            {col.links.map(link => (
              <a key={link} href="#" style={{ display: 'block', fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', marginBottom: 10, transition: 'color 150ms' }}
                onMouseEnter={e => e.target.style.color = '#BBCFEB'}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.65)'}
              >{link}</a>
            ))}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>© 2024 B&amp;D Artes &amp; Impressões. Todos os direitos reservados.</span>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Feito com ♥ e filamento PLA</span>
      </div>
    </div>
  </footer>
);

Object.assign(window, { BDFooter });
