// B&D Artes & Impressões — Cart Drawer Component

const BDCartDrawer = ({ open, onClose, items = [], onRemove, onCheckout }) => {
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(29,34,53,0.4)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 250ms ease-out', zIndex: 200,
        backdropFilter: 'blur(2px)',
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'white', zIndex: 201,
        boxShadow: '0 8px 40px rgba(29,34,53,0.18)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EEF1F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: '#1D2235' }}>Carrinho</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7494', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛍</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#1D2235', marginBottom: 6 }}>Carrinho vazio</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: '#6B7494' }}>Adicione presentes incríveis!</div>
            </div>
          ) : items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #EEF1F8' }}>
              <div style={{ width: 64, height: 64, background: '#E4EDF8', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8AAFD8" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 600, color: '#1D2235', marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#6B7494', marginBottom: 6 }}>Qtd: {item.qty}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: '#1D2235' }}>R$ {(item.price * item.qty).toFixed(2).replace('.', ',')}</div>
              </div>
              <button onClick={() => onRemove?.(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8AFCA', fontSize: 18, alignSelf: 'flex-start', padding: 2 }}>×</button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #EEF1F8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: '#6B7494' }}>Subtotal</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, color: '#1D2235', fontWeight: 500 }}>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: '#2E7D6E' }}>✓ Frete grátis</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#2E7D6E' }}>R$ 0,00</span>
            </div>
            <button onClick={onCheckout} style={{
              width: '100%', background: '#1D2235', color: 'white',
              fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600,
              padding: '14px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
            }}>Finalizar pedido</button>
            <button onClick={onClose} style={{
              width: '100%', background: 'transparent', color: '#6B7494',
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500,
              padding: '10px 0', border: 'none', cursor: 'pointer', marginTop: 4,
            }}>Continuar comprando</button>
          </div>
        )}
      </div>
    </>
  );
};

Object.assign(window, { BDCartDrawer });
