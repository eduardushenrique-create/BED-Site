// B&D Artes & Impressões — Header Component
// Usage: <script type="text/babel" src="Header.jsx"></script>

const BDHeader = ({ cartCount = 0, onCartOpen }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <header style={{
      background: 'white',
      borderBottom: '1px solid #D8DCE8',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '0 32px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        {/* Logo */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <img src="../../assets/logo.png" alt="B&D" style={{ height: 44, width: 44, objectFit: 'contain' }} />
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 17, color: '#1D2235', lineHeight: 1.1 }}>B&amp;D</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7494' }}>Artes &amp; Impressões</div>
          </div>
        </a>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[['#','Coleções'],['#','Presentes'],['#','Personalizados'],['sobre.html','Sobre nós'],['contato.html','Contato']].map(([href, item]) => (
            <a key={item} href={href} style={{
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500,
              color: '#3D4460', textDecoration: 'none',
              padding: '6px 12px', borderRadius: 8,
              transition: 'background 150ms',
            }}
            onMouseEnter={e => e.target.style.background = '#F0F5FB'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
            >{item}</a>
          ))}
        </nav>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setSearchOpen(!searchOpen)} style={iconBtnStyle} title="Buscar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <button style={iconBtnStyle} title="Favoritos">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button style={iconBtnStyle} title="Minha conta">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
          <button onClick={onCartOpen} style={{ ...iconBtnStyle, position: 'relative' }} title="Carrinho">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            {cartCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                background: '#D4849A', color: 'white',
                fontSize: 9, fontWeight: 700,
                width: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div style={{ borderTop: '1px solid #EEF1F8', padding: '12px 32px', background: '#FAFCFE' }}>
          <input
            autoFocus
            placeholder="Buscar presentes, decoração, personalizados..."
            style={{
              width: '100%', fontFamily: "'DM Sans',sans-serif", fontSize: 15,
              padding: '10px 16px', border: '1.5px solid #BBCFEB',
              borderRadius: 10, outline: 'none', background: 'white', color: '#1D2235',
            }}
          />
        </div>
      )}
    </header>
  );
};

const iconBtnStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: 8, borderRadius: 8, color: '#3D4460',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 150ms, color 150ms',
};

Object.assign(window, { BDHeader });
