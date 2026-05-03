'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type FilamentEntry = {
  id: string
  productId: string
  variantId: string | null
  variantName: string | null
  filamentId: string
  filamentName: string
  filamentBrand: string | null
  filamentType: string
  filamentColorHex: string | null
  pricePerKg: number
  pricePerGram: number
  grams: number
  notes: string | null
  cost: number
}

type Settings = {
  printerForCostId: string | null
  printingMinutes: number | null
  markupPercent: number | null
  errorRatePercent: number
  printerInfo: {
    id: string
    name: string
    powerConsumptionWatts: number | null
    acquisitionCostBRL: number | null
    lifetimeHours: number | null
  } | null
}

type FilamentOption = {
  id: string
  name: string
  brand: string | null
  type: string
  pricePerKg: number
  colorHex: string | null
  isActive: boolean
}

type PrinterOption = {
  id: string
  name: string
  powerConsumptionWatts: number | null
  acquisitionCostBRL: number | null
  lifetimeHours: number | null
}

type Variant = { id: string; name: string }

interface Props {
  productId: string
  variants?: Variant[]
}

const ENERGY_RATE = 1.0 // R$/kWh — alinhado com lib/product-cost.ts

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export default function ProductCostCalculator({ productId, variants = [] }: Props) {
  const [filaments, setFilaments] = useState<FilamentEntry[]>([])
  const [filamentOptions, setFilamentOptions] = useState<FilamentOption[]>([])
  const [printerOptions, setPrinterOptions] = useState<PrinterOption[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state local — sincroniza com `settings` no load
  const [printerForCostId, setPrinterForCostId] = useState('')
  const [printingMinutes, setPrintingMinutes] = useState('')
  const [markupPercent, setMarkupPercent] = useState('')
  const [errorRatePercent, setErrorRatePercent] = useState('30')
  const [finalPrice, setFinalPrice] = useState('')
  const lastEditRef = useRef<'markup' | 'price'>('markup')

  // Form pra adicionar filamento novo
  const [newFilamentId, setNewFilamentId] = useState('')
  const [newGrams, setNewGrams] = useState('')
  const [newVariantId, setNewVariantId] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [costRes, filRes, prtRes] = await Promise.all([
        fetch(`/api/produtos/${productId}/custo`, { cache: 'no-store' }),
        fetch('/api/filamentos?onlyActive=1', { cache: 'no-store' }),
        fetch('/api/impressoras', { cache: 'no-store' }),
      ])
      if (!costRes.ok) {
        setError('Erro ao carregar dados de custo.')
        return
      }
      const cost = await costRes.json()
      setFilaments(cost.filaments || [])
      setSettings(cost.settings || null)
      setCurrentPrice(typeof cost.currentPrice === 'number' ? cost.currentPrice : null)

      if (cost.settings) {
        setPrinterForCostId(cost.settings.printerForCostId || '')
        setPrintingMinutes(cost.settings.printingMinutes !== null ? String(cost.settings.printingMinutes) : '')
        setMarkupPercent(cost.settings.markupPercent !== null ? String(cost.settings.markupPercent) : '')
        setErrorRatePercent(String(cost.settings.errorRatePercent ?? 30))
      }
      if (typeof cost.currentPrice === 'number') setFinalPrice(String(cost.currentPrice))

      if (filRes.ok) {
        const d = await filRes.json()
        setFilamentOptions(Array.isArray(d.filaments) ? d.filaments : [])
      }
      if (prtRes.ok) {
        const data = await prtRes.json()
        setPrinterOptions(Array.isArray(data) ? data : [])
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  // Decomposição em tempo real
  const breakdown = useMemo(() => {
    const minutes = Number(printingMinutes) || 0
    const hours = minutes / 60
    const printer = printerOptions.find(p => p.id === printerForCostId) || null

    const filamentCost = filaments.reduce((sum, e) => sum + e.cost, 0)
    const energyCost =
      printer && printer.powerConsumptionWatts && printer.powerConsumptionWatts > 0
        ? hours * (printer.powerConsumptionWatts / 1000) * ENERGY_RATE
        : 0
    const depreciationCost =
      printer && printer.acquisitionCostBRL && printer.lifetimeHours && printer.lifetimeHours > 0
        ? hours * (printer.acquisitionCostBRL / printer.lifetimeHours)
        : 0
    const errRate = Number(errorRatePercent) || 0
    const errorCost = filamentCost * (errRate / 100)
    const total = filamentCost + energyCost + depreciationCost + errorCost

    const markup = Number(markupPercent) || 0
    const suggested = total * (1 + markup / 100)

    return {
      filamentCost: round2(filamentCost),
      energyCost: round2(energyCost),
      depreciationCost: round2(depreciationCost),
      errorCost: round2(errorCost),
      total: round2(total),
      suggested: round2(suggested),
    }
  }, [filaments, printerForCostId, printerOptions, printingMinutes, errorRatePercent, markupPercent])

  // Bidirecional: editar markup → recalcula preço sugerido (já feito acima);
  // editar preço final → recalcula markup% relativo ao total
  useEffect(() => {
    if (lastEditRef.current !== 'markup') return
    setFinalPrice(breakdown.suggested > 0 ? String(breakdown.suggested) : '')
  }, [breakdown.suggested])

  function handleMarkupChange(value: string) {
    lastEditRef.current = 'markup'
    setMarkupPercent(value)
  }

  function handleFinalPriceChange(value: string) {
    lastEditRef.current = 'price'
    setFinalPrice(value)
    const price = Number(value)
    if (Number.isFinite(price) && price >= 0 && breakdown.total > 0) {
      const newMarkup = ((price - breakdown.total) / breakdown.total) * 100
      setMarkupPercent(String(round2(newMarkup)))
    }
  }

  async function saveSettings() {
    setSaving(true)
    setFeedback(null)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        printerForCostId: printerForCostId || null,
        printingMinutes: printingMinutes === '' ? null : Number(printingMinutes),
        markupPercent: markupPercent === '' ? null : Number(markupPercent),
        errorRatePercent: errorRatePercent === '' ? null : Number(errorRatePercent),
      }
      // Se admin editou o preço final manualmente, persiste
      if (finalPrice !== '' && Number(finalPrice) !== currentPrice) {
        payload.price = Number(finalPrice)
      }

      const res = await fetch(`/api/produtos/${productId}/custo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Erro ao salvar.')
        return
      }
      setFeedback('Configuração de custo salva.')
      load()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  async function addFilament() {
    if (!newFilamentId || !newGrams) return
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/custo/filamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filamentId: newFilamentId,
          variantId: newVariantId || null,
          grams: Number(newGrams),
          notes: newNotes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Erro ao adicionar filamento.')
        return
      }
      setNewFilamentId('')
      setNewGrams('')
      setNewVariantId('')
      setNewNotes('')
      load()
    } catch {
      setError('Erro de conexão.')
    }
  }

  async function removeFilament(entry: FilamentEntry) {
    if (!window.confirm(`Remover "${entry.filamentName}" do produto?`)) return
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/custo/filamentos/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Erro.')
        return
      }
      load()
    } catch {
      setError('Erro de conexão.')
    }
  }

  async function updateFilament(entry: FilamentEntry, fields: { grams?: number; notes?: string | null }) {
    setError('')
    try {
      const res = await fetch(`/api/produtos/${productId}/custo/filamentos/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Erro.')
        return
      }
      load()
    } catch {
      setError('Erro de conexão.')
    }
  }

  const selectedPrinter = printerOptions.find(p => p.id === printerForCostId) || null

  if (loading) {
    return (
      <section style={cardStyle}>
        <p style={{ margin: 0, fontSize: '13px', color: '#6B7494' }}>Carregando calculadora...</p>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '17px', color: '#1D2235' }}>Calculadora de custo</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7494' }}>
            Custo de produção baseado em filamentos, tempo de impressão, energia e depreciação. Markup e preço final são bidirecionais.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
          {error}
        </div>
      )}
      {feedback && (
        <div style={{ background: '#DCFCE7', color: '#166534', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: '20px' }}>
        <div>
          <h3 style={subtitleStyle}>Filamentos consumidos por unidade</h3>
          {filaments.length === 0 ? (
            <div style={{ background: '#FEF3C7', color: '#92400E', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
              Nenhum filamento vinculado. Adicione abaixo pra calcular custo de matéria-prima.
            </div>
          ) : (
            <div style={{ border: '1px solid #E3E9F4', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
              {filaments.map((entry, idx) => (
                <FilamentRow
                  key={entry.id}
                  entry={entry}
                  isLast={idx === filaments.length - 1}
                  onUpdate={updateFilament}
                  onRemove={removeFilament}
                />
              ))}
            </div>
          )}

          {/* Não pode ser <form> aqui — este componente é embarcado dentro do
              form do editor de produto e HTML não permite forms aninhados. Usar
              div + button type="button" evita que clicar em "Vincular"
              submeta o form externo (que salva o produto e redireciona). */}
          <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: '#1D2235', fontWeight: 600 }}>+ Adicionar filamento</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <Field label="Filamento">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(() => {
                    const selected = filamentOptions.find(f => f.id === newFilamentId)
                    if (!selected || !selected.colorHex) return null
                    return (
                      <span
                        aria-label={`Cor ${selected.colorHex}`}
                        title={selected.colorHex}
                        style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', background: selected.colorHex, border: '1px solid #D8DCE8', flexShrink: 0 }}
                      />
                    )
                  })()}
                  <select value={newFilamentId} onChange={e => setNewFilamentId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Selecione...</option>
                    {filamentOptions.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.type}){f.brand ? ` · ${f.brand}` : ''} — {brl(f.pricePerKg)}/kg
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Gramas por unidade">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newGrams}
                  onChange={e => setNewGrams(e.target.value)}
                  placeholder="Ex.: 35"
                  style={inputStyle}
                />
              </Field>
              {variants.length > 0 && (
                <Field label="Aplicar a">
                  <select value={newVariantId} onChange={e => setNewVariantId(e.target.value)} style={inputStyle}>
                    <option value="">Todas as variações (global)</option>
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>Variação: {v.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Observação">
                <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Ex.: cor preta" style={inputStyle} />
              </Field>
            </div>
            <button
              type="button"
              onClick={addFilament}
              disabled={!newFilamentId || !newGrams}
              style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: !newFilamentId || !newGrams ? 'not-allowed' : 'pointer', fontSize: '13px', justifySelf: 'start' }}
            >
              + Vincular
            </button>
          </div>

          <h3 style={subtitleStyle}>Tempo & equipamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <Field label="Tempo de impressão (minutos)">
              <input
                type="number"
                min="0"
                step="1"
                value={printingMinutes}
                onChange={e => setPrintingMinutes(e.target.value)}
                placeholder="Ex.: 90"
                style={inputStyle}
              />
            </Field>
            <Field label="Impressora usada">
              <select value={printerForCostId} onChange={e => setPrinterForCostId(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                {printerOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.powerConsumptionWatts ? ` · ${p.powerConsumptionWatts}W` : ''}
                  </option>
                ))}
              </select>
              {selectedPrinter && (!selectedPrinter.powerConsumptionWatts || !selectedPrinter.acquisitionCostBRL || !selectedPrinter.lifetimeHours) && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#92400E' }}>
                  ⚠️ Esta impressora está sem alguns campos de custo (consumo/aquisição/vida útil). Energia/depreciação ficam zerados até você completar em /admin/impressoras.
                </p>
              )}
            </Field>
            <Field label="Taxa de erro (%)">
              <input
                type="number"
                min="0"
                step="0.1"
                value={errorRatePercent}
                onChange={e => setErrorRatePercent(e.target.value)}
                style={inputStyle}
              />
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6B7494' }}>
                Aplicada sobre custo de filamento (default 30%).
              </p>
            </Field>
            <Field label="Markup (%)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={markupPercent}
                onChange={e => handleMarkupChange(e.target.value)}
                placeholder="Ex.: 200"
                style={inputStyle}
              />
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6B7494' }}>
                Sobre o custo total. Editar o preço final ao lado recalcula este valor.
              </p>
            </Field>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Salvando...' : 'Salvar configuração de custo'}
          </button>
        </div>

        <aside style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
          <div style={{ background: '#F9FBFD', borderRadius: '12px', padding: '16px', border: '1px solid #E3E9F4' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '14px', color: '#1D2235', fontWeight: 700 }}>Decomposição</h3>
            <Row label="Filamento" value={breakdown.filamentCost} />
            <Row label={`Erro (${errorRatePercent}%)`} value={breakdown.errorCost} />
            <Row label="Energia" value={breakdown.energyCost} hint={selectedPrinter?.powerConsumptionWatts ? `${selectedPrinter.powerConsumptionWatts}W × R$ 1,00/kWh` : 'sem dados'} />
            <Row label="Depreciação" value={breakdown.depreciationCost} hint={selectedPrinter?.acquisitionCostBRL && selectedPrinter?.lifetimeHours ? `${brl(selectedPrinter.acquisitionCostBRL)} / ${selectedPrinter.lifetimeHours}h` : 'sem dados'} />
            <hr style={{ border: 'none', borderTop: '1px solid #E3E9F4', margin: '8px 0' }} />
            <Row label="Custo total" value={breakdown.total} bold />

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #E3E9F4' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>Preço sugerido (com markup)</p>
              <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 700, color: '#1D2235', fontFamily: 'var(--font-mono)' }}>
                {brl(breakdown.suggested)}
              </p>
            </div>

            <div style={{ marginTop: '14px' }}>
              <Field label="Preço final (R$)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalPrice}
                  onChange={e => handleFinalPriceChange(e.target.value)}
                  style={{ ...inputStyle, fontWeight: 700 }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6B7494' }}>
                  Editar este valor recalcula o markup. Salve abaixo pra persistir.
                </p>
              </Field>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function FilamentRow({
  entry,
  isLast,
  onUpdate,
  onRemove,
}: {
  entry: FilamentEntry
  isLast: boolean
  onUpdate: (entry: FilamentEntry, fields: { grams?: number; notes?: string | null }) => void
  onRemove: (entry: FilamentEntry) => void
}) {
  const [grams, setGrams] = useState(String(entry.grams))
  const [notes, setNotes] = useState(entry.notes || '')
  const [editing, setEditing] = useState(false)
  const dirty = grams !== String(entry.grams) || notes !== (entry.notes || '')

  return (
    <div style={{ padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid #E3E9F4', display: 'grid', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {entry.filamentColorHex && (
            <span
              aria-label={`Cor ${entry.filamentColorHex}`}
              title={entry.filamentColorHex}
              style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: entry.filamentColorHex,
                border: '1px solid #D8DCE8',
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: '#1D2235' }}>
              {entry.filamentName}
              <span style={{ background: '#E4EDF8', color: '#4A7AB5', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', marginLeft: '8px', fontWeight: 600 }}>
                {entry.filamentType}
              </span>
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7494' }}>
              {entry.filamentBrand ? `${entry.filamentBrand} · ` : ''}{brl(entry.pricePerKg)}/kg
              {entry.variantName && ` · variação: ${entry.variantName}`}
            </p>
          </div>
        </div>
        {editing ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                onUpdate(entry, { grams: Number(grams), notes: notes.trim() || null })
                setEditing(false)
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed', opacity: dirty ? 1 : 0.5, fontSize: '12px' }}
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setGrams(String(entry.grams))
                setNotes(entry.notes || '')
                setEditing(false)
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', cursor: 'pointer', fontSize: '12px' }}
            >
              Remover
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          <Field label="Gramas">
            <input type="number" min="0" step="0.1" value={grams} onChange={e => setGrams(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Observação">
            <input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
          </Field>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '13px', color: '#1D2235' }}>
          <strong>{entry.grams}g</strong> = <strong>{brl(entry.cost)}</strong>
          {entry.notes && <span style={{ color: '#6B7494' }}> · {entry.notes}</span>}
        </p>
      )}
    </div>
  )
}

function Row({ label, value, hint, bold }: { label: string; value: number; hint?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', padding: '4px 0' }}>
      <div>
        <span style={{ fontSize: '13px', color: '#1D2235', fontWeight: bold ? 700 : 500 }}>{label}</span>
        {hint && <p style={{ margin: 0, fontSize: '10px', color: '#A8AFCA' }}>{hint}</p>}
      </div>
      <span style={{ fontSize: bold ? '15px' : '13px', fontWeight: bold ? 700 : 500, color: '#1D2235', fontFamily: 'var(--font-mono)' }}>
        {brl(value)}
      </span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#1D2235', fontWeight: 600 }}>
      {label}
      {children}
    </label>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '14px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const subtitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '13px',
  color: '#1D2235',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #D8DCE8',
  fontSize: '13px',
  fontFamily: 'inherit',
  width: '100%',
}
