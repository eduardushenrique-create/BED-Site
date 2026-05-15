'use client'

/**
 * SPEC-007 §3.1.3 — formulário compartilhado entre /novo e /[id].
 *
 * Responsabilidades:
 * - Coleta inputs (identificação, cliente, impressão, componentes).
 * - Debounce 300ms → POST /api/orcamentos/calcular → atualiza CostBreakdownCard.
 * - Salva via POST (novo) ou PATCH (edição).
 * - Abre ConvertToOrderModal quando orçamento já existe (tem id).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CostBreakdownCard, { type BreakdownResult } from './CostBreakdownCard'
import ComponentSelector, { type EstimateComponent } from './ComponentSelector'
import ConvertToOrderModal from './ConvertToOrderModal'

// ── Tipos ──────────────────────────────────────────────────────────────────

type FilamentOption = {
  id: string
  name: string
  brand: string
  pricePerKg: number
}

type PrinterOption = {
  id: string
  name: string
}

type Estimate = {
  id: string
  name: string
  status: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  notes: string | null
  quantity: number
  filamentId: string | null
  filamentGrams: number
  printHours: number
  printerId: string | null
  components: EstimateComponent[]
  errorRate: number
  marginPercent: number
  costTotal: number
  suggestedPrice: number
  finalPrice: number | null
  convertedToOrderId: string | null
}

type Props = {
  /** Se undefined → criação. Se presente → edição. */
  estimate?: Estimate
}

// ── Tokens visuais ─────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
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

const GRID2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '14px',
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Enviado' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
] as const

// ── Componente ─────────────────────────────────────────────────────────────

export default function EstimateForm({ estimate }: Props) {
  const router = useRouter()
  const isNew = !estimate

  // ── Estado do formulário ────────────────────────────────────────────────
  const [name, setName] = useState(estimate?.name ?? '')
  const [status, setStatus] = useState(estimate?.status ?? 'draft')
  const [customerName, setCustomerName] = useState(estimate?.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(estimate?.customerPhone ?? '')
  const [customerEmail, setCustomerEmail] = useState(estimate?.customerEmail ?? '')
  const [notes, setNotes] = useState(estimate?.notes ?? '')
  const [quantity, setQuantity] = useState(String(estimate?.quantity ?? 1))
  const [filamentId, setFilamentId] = useState(estimate?.filamentId ?? '')
  const [filamentGrams, setFilamentGrams] = useState(String(estimate?.filamentGrams ?? ''))
  const [printHours, setPrintHours] = useState(String(estimate?.printHours ?? ''))
  const [printerId, setPrinterId] = useState(estimate?.printerId ?? '')
  const [components, setComponents] = useState<EstimateComponent[]>(estimate?.components ?? [])
  const [errorRateOverride, setErrorRateOverride] = useState<number | null>(
    estimate ? estimate.errorRate : null,
  )
  const [marginOverride, setMarginOverride] = useState<number | null>(null)
  const [finalPrice, setFinalPrice] = useState(
    estimate?.finalPrice != null ? String(estimate.finalPrice) : '',
  )

  // ── Estado de cálculo ───────────────────────────────────────────────────
  const [breakdown, setBreakdown] = useState<BreakdownResult | null>(null)
  const [calcStale, setCalcStale] = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Dados de lookup ─────────────────────────────────────────────────────
  const [filaments, setFilaments] = useState<FilamentOption[]>([])
  const [printers, setPrinters] = useState<PrinterOption[]>([])

  useEffect(() => {
    // Carrega filamentos e impressoras em paralelo
    Promise.all([
      fetch('/api/filamentos?pageSize=100', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : { items: [] })
        .then(d => (d.items ?? d ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
          brand: f.brand ?? '',
          pricePerKg: Number(f.pricePerKg),
        }))),
      fetch('/api/impressoras?pageSize=100', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : { items: [] })
        .then(d => (d.items ?? d ?? []).map((p: any) => ({ id: p.id, name: p.name }))),
    ]).then(([fils, prts]) => {
      setFilaments(fils)
      setPrinters(prts)
    }).catch(() => {})
  }, [])

  // ── Inicializa breakdown a partir do estimate salvo ─────────────────────
  useEffect(() => {
    if (estimate) {
      setBreakdown({
        costFilament: 0,
        costEnergy: 0,
        costDepreciation: 0,
        costError: 0,
        costComponents: 0,
        costTotal: estimate.costTotal,
        suggestedPrice: estimate.suggestedPrice,
        marginPercentApplied: estimate.marginPercent,
      })
      setMarginOverride(estimate.marginPercent)
    }
  }, [estimate])

  // ── Cálculo em tempo real (debounce 300ms) ──────────────────────────────
  const runCalc = useCallback(async (fields: {
    filamentId: string
    filamentGrams: string
    printHours: string
    printerId: string
    components: EstimateComponent[]
    errorRateOverride: number | null
    marginOverride: number | null
  }) => {
    const grams = Number(fields.filamentGrams)
    const hours = Number(fields.printHours)
    if (!fields.filamentId || grams <= 0 || hours <= 0) return

    setCalcStale(true)
    setCalcLoading(true)
    try {
      const body: Record<string, unknown> = {
        filamentId: fields.filamentId || null,
        filamentGrams: grams,
        printHours: hours,
        printerId: fields.printerId || null,
        components: fields.components.map(c => ({
          componentId: c.componentId,
          qty: c.qty,
          unitCostOverride: c.unitCostSnapshot,
          name: c.name,
          unit: c.unit,
        })),
      }
      if (fields.errorRateOverride !== null) {
        body.errorRateOverride = fields.errorRateOverride
      }
      if (fields.marginOverride !== null) {
        body.marginPercentOverride = fields.marginOverride
      }

      const res = await fetch('/api/orcamentos/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      const data = await res.json()
      setBreakdown({
        costFilament: data.costFilament,
        costEnergy: data.costEnergy,
        costDepreciation: data.costDepreciation,
        costError: data.costError,
        costComponents: data.costComponents,
        costTotal: data.costTotal,
        suggestedPrice: data.suggestedPrice,
        marginPercentApplied: data.marginPercentApplied,
      })
    } catch {
      // Mantém o breakdown anterior — sem mensagem de erro inline
    } finally {
      setCalcLoading(false)
      setCalcStale(false)
    }
  }, [])

  // Dispara debounce sempre que qualquer campo de cálculo muda
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runCalc({ filamentId, filamentGrams, printHours, printerId, components, errorRateOverride, marginOverride })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filamentId, filamentGrams, printHours, printerId, components, errorRateOverride, marginOverride, runCalc])

  // ── Submissão ───────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [showConvert, setShowConvert] = useState(false)

  async function save(nextStatus?: string) {
    if (!name.trim()) {
      setFeedback({ kind: 'err', text: 'Nome do orçamento é obrigatório.' })
      return
    }
    const grams = Number(filamentGrams)
    const hours = Number(printHours)
    if (!filamentId) {
      setFeedback({ kind: 'err', text: 'Selecione um filamento.' })
      return
    }
    if (grams <= 0) {
      setFeedback({ kind: 'err', text: 'Gramas deve ser maior que zero.' })
      return
    }
    if (hours <= 0) {
      setFeedback({ kind: 'err', text: 'Horas de impressão deve ser maior que zero.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    const body: Record<string, unknown> = {
      name: name.trim(),
      status: nextStatus ?? status,
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      customerEmail: customerEmail.trim() || null,
      notes: notes.trim() || null,
      quantity: Number(quantity) || 1,
      filamentId: filamentId || null,
      filamentGrams: grams,
      printHours: hours,
      printerId: printerId || null,
      components: components.map(c => ({
        componentId: c.componentId,
        qty: c.qty,
        unitCostOverride: c.unitCostSnapshot,
        name: c.name,
        unit: c.unit,
      })),
      finalPrice: finalPrice ? Number(finalPrice) : null,
    }
    if (errorRateOverride !== null) body.errorRateOverride = errorRateOverride
    if (marginOverride !== null) body.marginPercentOverride = marginOverride

    try {
      const url = isNew ? '/api/orcamentos' : `/api/orcamentos/${estimate!.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      if (isNew) {
        router.push(`/admin/orcamentos/${data.id}`)
      } else {
        setFeedback({ kind: 'ok', text: 'Orçamento salvo.' })
      }
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar.',
      })
    } finally {
      setSaving(false)
    }
  }

  const isConverted = estimate?.status === 'converted'
  const canConvert = !isNew && !isConverted

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '12px' }}>
        <Link
          href="/admin/orcamentos"
          style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}
        >
          ← Orçamentos
        </Link>
      </div>

      {/* Header */}
      <header style={{ marginBottom: '24px' }}>
        <p
          style={{
            fontSize: '12px',
            color: '#4A7AB5',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          {isNew ? 'Novo orçamento' : 'Editar orçamento'}
        </p>
        <h1
          style={{
            fontSize: 'clamp(22px, 3vw, 30px)',
            color: '#1D2235',
            margin: '6px 0 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={name || 'Novo orçamento'}
        >
          {name || 'Novo orçamento'}
        </h1>
        {isConverted && estimate?.convertedToOrderId && (
          <p style={{ color: '#0E9F6E', margin: 0, fontSize: '14px' }}>
            Convertido em pedido.{' '}
            <Link
              href={`/admin/pedidos/${estimate.convertedToOrderId}`}
              style={{ color: '#0E9F6E', fontWeight: 600 }}
            >
              Ver pedido →
            </Link>
          </p>
        )}
      </header>

      {/* Feedback global */}
      {feedback && (
        <div
          role="alert"
          style={{
            background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2',
            color: feedback.kind === 'ok' ? '#166534' : '#B42318',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {feedback.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px', maxWidth: '900px' }}>
        {/* Card: Identificação */}
        <section style={CARD}>
          <h2 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 600, color: '#1D2235' }}>
            Identificação
          </h2>
          <div style={GRID2}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="est-name" style={LABEL_STYLE}>
                Nome do orçamento *
              </label>
              <input
                id="est-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Fernando — Círculo Dardo"
                required
                disabled={isConverted}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label htmlFor="est-status" style={LABEL_STYLE}>
                Status
              </label>
              <select
                id="est-status"
                value={status}
                onChange={e => setStatus(e.target.value)}
                disabled={isConverted}
                style={INPUT_STYLE}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {isConverted && (
                  <option value="converted">Convertido em pedido</option>
                )}
              </select>
            </div>
            <div>
              <label htmlFor="est-qty" style={LABEL_STYLE}>
                Quantidade *
              </label>
              <input
                id="est-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                disabled={isConverted}
                style={INPUT_STYLE}
              />
            </div>
          </div>
        </section>

        {/* Card: Cliente */}
        <section style={CARD}>
          <h2 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 600, color: '#1D2235' }}>
            Cliente <span style={{ fontWeight: 400, color: '#9AA2B8', fontSize: '14px' }}>(opcional)</span>
          </h2>
          <div style={GRID2}>
            <div>
              <label htmlFor="est-cust-name" style={LABEL_STYLE}>Nome</label>
              <input
                id="est-cust-name"
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                disabled={isConverted}
                placeholder="Ex: Fernando"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label htmlFor="est-cust-phone" style={LABEL_STYLE}>Telefone</label>
              <input
                id="est-cust-phone"
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                disabled={isConverted}
                placeholder="(11) 99999-9999"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label htmlFor="est-cust-email" style={LABEL_STYLE}>E-mail</label>
              <input
                id="est-cust-email"
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                disabled={isConverted}
                placeholder="cliente@email.com"
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="est-notes" style={LABEL_STYLE}>Observações</label>
              <textarea
                id="est-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={isConverted}
                rows={3}
                placeholder="Ex: Cliente indicado pela Beatriz, paga só no PIX"
                style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: '72px' }}
              />
            </div>
          </div>
        </section>

        {/* Card: Impressão */}
        <section style={CARD}>
          <h2 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 600, color: '#1D2235' }}>
            Impressão
          </h2>
          <div style={GRID2}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="est-filament" style={LABEL_STYLE}>
                Filamento *
              </label>
              <select
                id="est-filament"
                value={filamentId}
                onChange={e => setFilamentId(e.target.value)}
                required
                disabled={isConverted}
                style={INPUT_STYLE}
              >
                <option value="">Selecione o filamento…</option>
                {filaments.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.brand ? `${f.brand} — ` : ''}{f.name} ({f.pricePerKg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="est-grams" style={LABEL_STYLE}>
                Gramas de filamento *
              </label>
              <input
                id="est-grams"
                type="number"
                min="0.01"
                step="0.01"
                value={filamentGrams}
                onChange={e => setFilamentGrams(e.target.value)}
                placeholder="300"
                required
                disabled={isConverted}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label htmlFor="est-hours" style={LABEL_STYLE}>
                Horas de impressão *
              </label>
              <input
                id="est-hours"
                type="number"
                min="0.01"
                step="0.01"
                value={printHours}
                onChange={e => setPrintHours(e.target.value)}
                placeholder="9.0"
                required
                disabled={isConverted}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label htmlFor="est-printer" style={LABEL_STYLE}>
                Impressora <span style={{ fontWeight: 400, color: '#9AA2B8' }}>(opcional — usa defaults)</span>
              </label>
              <select
                id="est-printer"
                value={printerId}
                onChange={e => setPrinterId(e.target.value)}
                disabled={isConverted}
                style={INPUT_STYLE}
              >
                <option value="">Usar defaults globais</option>
                {printers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="est-error-rate" style={LABEL_STYLE}>
                Taxa de erro (%)
              </label>
              <input
                id="est-error-rate"
                type="number"
                min="0"
                max="100"
                step="1"
                value={errorRateOverride !== null ? (errorRateOverride * 100).toFixed(0) : ''}
                onChange={e => {
                  const v = Number(e.target.value)
                  setErrorRateOverride(Number.isFinite(v) ? v / 100 : null)
                }}
                placeholder="30 (default global)"
                disabled={isConverted}
                style={INPUT_STYLE}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
                Deixe em branco para usar o default das configurações.
              </p>
            </div>
          </div>
        </section>

        {/* Card: Componentes */}
        <section style={CARD}>
          <h2 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 600, color: '#1D2235' }}>
            Componentes adicionais{' '}
            <span style={{ fontWeight: 400, color: '#9AA2B8', fontSize: '14px' }}>(opcional)</span>
          </h2>
          {isConverted ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {components.length === 0 && (
                <li style={{ color: '#9AA2B8', fontSize: '14px' }}>Nenhum componente.</li>
              )}
              {components.map((c, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid #EEF1F8',
                    fontSize: '14px',
                    color: '#1D2235',
                  }}
                >
                  <span>{c.name} × {c.qty}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#6B7494' }}>
                    R$ {(c.qty * c.unitCostSnapshot).toFixed(2).replace('.', ',')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ComponentSelector components={components} onChange={setComponents} />
          )}
        </section>

        {/* Card: Cálculo */}
        <CostBreakdownCard
          result={breakdown}
          stale={calcStale}
          loading={calcLoading}
          marginOverride={marginOverride}
          onMarginChange={setMarginOverride}
          finalPrice={finalPrice}
          onFinalPriceChange={setFinalPrice}
        />

        {/* Ações */}
        {!isConverted && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingTop: '8px',
            }}
          >
            <Link
              href="/admin/orcamentos"
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #D8DCE8',
                color: '#6B7494',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Cancelar
            </Link>
            <button
              type="button"
              onClick={() => save('draft')}
              disabled={saving}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #D8DCE8',
                backgroundColor: 'white',
                color: '#1D2235',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            <button
              type="button"
              onClick={() => save('sent')}
              disabled={saving}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#4A7AB5',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Salvando…' : 'Salvar e marcar enviado'}
            </button>
            {canConvert && (
              <button
                type="button"
                onClick={() => setShowConvert(true)}
                disabled={saving}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#0E9F6E',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Converter em pedido →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal converter */}
      {showConvert && estimate && (
        <ConvertToOrderModal
          estimate={{
            id: estimate.id,
            name: estimate.name,
            customerName: estimate.customerName,
            finalPrice: estimate.finalPrice,
            suggestedPrice: estimate.suggestedPrice,
            costTotal: estimate.costTotal,
          }}
          onClose={() => setShowConvert(false)}
          onConverted={(orderId, orderNumber) => {
            setShowConvert(false)
            router.push(`/admin/pedidos/${orderId}`)
          }}
        />
      )}
    </div>
  )
}
