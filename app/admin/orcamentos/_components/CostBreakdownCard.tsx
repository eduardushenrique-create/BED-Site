'use client'

/**
 * SPEC-007 §3.1.3 — bloco "Cálculo" do formulário de orçamento.
 *
 * Recebe o resultado do dry-run (POST /api/orcamentos/calcular) e exibe
 * os 5 sub-custos + total + margem + preço sugerido. O pai controla o
 * estado "stale" (calculando) via prop `stale` — enquanto stale, o card
 * reduz opacidade para indicar que os números ainda são do cálculo anterior.
 */

export type BreakdownResult = {
  costFilament: number
  costEnergy: number
  costDepreciation: number
  costError: number
  costComponents: number
  costTotal: number
  suggestedPrice: number
  marginPercentApplied: number
}

type Props = {
  result: BreakdownResult | null
  stale: boolean
  loading: boolean
  /** Margem editável pelo admin (0-1). Null = usa sugestão do servidor. */
  marginOverride: number | null
  onMarginChange: (v: number | null) => void
  /** Preço final definido pelo admin (null = usa sugestão). */
  finalPrice: string
  onFinalPriceChange: (v: string) => void
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CARD: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
}

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: '14px',
  padding: '6px 0',
  color: '#1D2235',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1D2235',
  marginBottom: '6px',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  backgroundColor: 'white',
  color: '#1D2235',
}

export default function CostBreakdownCard({
  result,
  stale,
  loading,
  marginOverride,
  onMarginChange,
  finalPrice,
  onFinalPriceChange,
}: Props) {
  const opacity = stale ? 0.55 : 1

  const marginDisplayPct = result
    ? marginOverride !== null
      ? (marginOverride * 100).toFixed(0)
      : (result.marginPercentApplied * 100).toFixed(0)
    : '—'

  return (
    <section style={CARD} aria-label="Cálculo de custo">
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: '#1D2235' }}>
        Cálculo
        {loading && (
          <span style={{ marginLeft: '10px', fontSize: '13px', fontWeight: 400, color: '#6B7494' }}>
            calculando…
          </span>
        )}
      </h2>

      {!result && !loading && (
        <p style={{ color: '#9AA2B8', fontSize: '14px', margin: 0 }}>
          Preencha filamento, gramas e horas para ver o cálculo.
        </p>
      )}

      {(result || loading) && (
        <div style={{ transition: 'opacity 150ms ease', opacity }}>
          {/* Breakdown de custos */}
          <div style={{ borderBottom: '1px solid #EEF1F8', paddingBottom: '12px', marginBottom: '12px' }}>
            <div style={ROW}>
              <span style={{ color: '#6B7494' }}>Custo filamento</span>
              <span style={MONO}>{result ? fmtBRL(result.costFilament) : '—'}</span>
            </div>
            <div style={ROW}>
              <span style={{ color: '#6B7494' }}>Custo energia</span>
              <span style={MONO}>{result ? fmtBRL(result.costEnergy) : '—'}</span>
            </div>
            <div style={ROW}>
              <span style={{ color: '#6B7494' }}>Depreciação</span>
              <span style={MONO}>{result ? fmtBRL(result.costDepreciation) : '—'}</span>
            </div>
            <div style={ROW}>
              <span style={{ color: '#6B7494' }}>Taxa de erro</span>
              <span style={MONO}>{result ? fmtBRL(result.costError) : '—'}</span>
            </div>
            <div style={ROW}>
              <span style={{ color: '#6B7494' }}>Componentes</span>
              <span style={MONO}>{result ? fmtBRL(result.costComponents) : '—'}</span>
            </div>
          </div>

          {/* Total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '8px 0 16px',
              borderBottom: '1px solid #EEF1F8',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#1D2235' }}>
              Custo total
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '18px',
                color: '#1D2235',
              }}
            >
              {result ? fmtBRL(result.costTotal) : '—'}
            </span>
          </div>

          {/* Margem */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label htmlFor="margin-input" style={{ ...LABEL_STYLE, marginBottom: 0 }}>
                Margem {result ? `(sugestão: ${(result.marginPercentApplied * 100).toFixed(0)}%)` : ''}
              </label>
              {marginOverride !== null && (
                <button
                  type="button"
                  onClick={() => onMarginChange(null)}
                  style={{
                    fontSize: '12px',
                    color: '#4A7AB5',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    textDecoration: 'underline',
                  }}
                >
                  ↻ Restaurar sugestão
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="margin-input"
                type="number"
                min="0"
                max="1000"
                step="1"
                value={marginOverride !== null ? (marginOverride * 100).toFixed(0) : (result ? (result.marginPercentApplied * 100).toFixed(0) : '')}
                onChange={e => {
                  const v = Number(e.target.value)
                  if (!Number.isNaN(v) && v >= 0) {
                    onMarginChange(v / 100)
                  }
                }}
                style={{ ...INPUT_STYLE, width: '100px' }}
                aria-label="Margem em percentual"
              />
              <span style={{ color: '#6B7494', fontSize: '14px' }}>%</span>
              {marginOverride === null && result && (
                <span style={{ fontSize: '12px', color: '#6B7494' }}>
                  (automática por faixa de custo)
                </span>
              )}
            </div>
          </div>

          {/* Preço sugerido */}
          <div style={{ ...ROW, marginBottom: '16px' }}>
            <span style={{ color: '#6B7494' }}>Preço sugerido ({marginDisplayPct}%)</span>
            <span style={{ ...MONO, fontWeight: 600, fontSize: '15px', color: '#0E9F6E' }}>
              {result ? fmtBRL(result.suggestedPrice) : '—'}
            </span>
          </div>

          {/* Preço final */}
          <div>
            <label htmlFor="final-price-input" style={LABEL_STYLE}>
              Preço final ao cliente
            </label>
            <input
              id="final-price-input"
              type="number"
              min="0"
              step="0.01"
              placeholder={result ? result.suggestedPrice.toFixed(2) : '0.00'}
              value={finalPrice}
              onChange={e => onFinalPriceChange(e.target.value)}
              style={{ ...INPUT_STYLE, fontFamily: 'var(--font-mono)', fontSize: '15px' }}
              aria-describedby="final-price-hint"
            />
            <p id="final-price-hint" style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
              Deixe em branco para usar o preço sugerido. Sobrescrever fica registrado no histórico.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
