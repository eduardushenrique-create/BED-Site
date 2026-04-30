// B&D Artes & Impressões — Product Card Component

const BDProductCard = ({ name, price, oldPrice, badge, badgeType = 'new', onAddToCart, onFavorite, favorited = false }) => {
  const [hovered, setHovered] = React.useState(false);
  const [fav, setFav] = React.useState(favorited);

  const badgeColors = {
    new:    { bg: '#1D2235', color: '#fff' },
    sale:   { bg: '#D4849A', color: '#fff' },
    hot:    { bg: '#BBCFEB', color: '#1D2235' },
    sold:   { bg: '#EEF1F8', color: '#6B7494' },
    custom: { bg: '#F7E6EB', color: '#D4849A' },
  };
  const bc = badgeColors[badgeType] || badgeColors.new;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: hovered
          ? '0 8px 24px rgba(29,34,53,0.12), 0 2px 6px rgba(29,34,53,0.06)'
          : '0 1px 4px rgba(29,34,53,0.07), 0 4px 12px rgba(29,34,53,0.05)',
        transform: hovered ? 'translateY(-4px) scale(1.01)' : 'none',
        transition: 'all 250ms ease-out',
      }}
    >
      {/* Image area */}
      <div style={{ position: 'relative', background: '#E4EDF8', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8AAFD8" strokeWidth="1.2" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        {badge && (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: bc.bg, color: bc.color,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase',
            fontFamily: "'DM Sans',sans-serif",
          }}>{badge}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); setFav(!fav); onFavorite?.(!fav); }}
          style={{
            position: 'absolute', top: 8, right: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: fav ? '#D4849A' : '#A8AFCA',
            transition: 'color 150ms, transform 150ms',
            transform: fav ? 'scale(1.15)' : 'scale(1)',
            lineHeight: 1,
          }}
        >♥</button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, color: '#1D2235', lineHeight: 1.35, marginBottom: 8 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          {oldPrice && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#A8AFCA', textDecoration: 'line-through' }}>{oldPrice}</span>}
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: '#1D2235' }}>{price}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onAddToCart?.(); }}
          style={{
            width: '100%', fontFamily: "'DM Sans',sans-serif", fontSize: 13,
            fontWeight: 600, padding: '9px 0', borderRadius: 8,
            background: hovered ? '#1D2235' : '#2E3650',
            color: 'white', border: 'none', cursor: 'pointer',
            transition: 'background 150ms',
          }}
        >Adicionar ao carrinho</button>
      </div>
    </div>
  );
};

Object.assign(window, { BDProductCard });
