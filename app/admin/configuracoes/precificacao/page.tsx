'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Tier = {
  maxCost: number | null
  marginPercent: number
}

type PricingSettings = {
  defaultEnergyCostPerHour: number
  defaultDepreciationPerHour: number
  defaultErrorRate: number
  energyTariffPerKwh: number
  marginTiers: Tier[]
  updatedAt: string | null
  updatedByEmail: string | null
}

type Feedback = { kind: 'ok' | 'err'; text: string }

const CARD: React.CSSProperties = {
  background: 'white',
  borderRadius: '14px',
  padding: '20px 22px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.07)',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#1D2235',
  marginBottom: '6px',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D9DDF0',
  background: 'white',
  fontSize: '14px',
  color: '#1D2235',
  fontVariantNumeric: 'tabular-nums',
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PricingSettingsPage() {
  const [data, setData] = useState<PricingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/pricing-settings', { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setFeedback({ kind: 'err', text: j?.error || 'Erro ao carregar.' })
        return
      }
      setData(await res.json())
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(updates: Partial<PricingSettings & { marginTiers: Tier[] }>) {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/pricing-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setFeedback({ kind: 'err', text: j?.error || 'Erro ao salvar.' })
        return
      }
      setData(j)
      setFeedback({ kind: 'ok', text: 'Configuração salva.' })
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  function updateField(field: keyof PricingSettings, value: number) {
    if (!data) return
    setData({ ...data, [field]: value })
  }

  function updateTier(index: number, patch: Partial<Tier>) {
    if (!data) return
    const next = data.marginTiers.map((t, i) => (i === index ? { ...t, ...patch } : t))
    setData({ ...data, marginTiers: next })
  }

  function removeTier(index: number) {
    if (!data) return
    const next = data.marginTiers.filter((_, i) => i !== index)
    // Garante que ainda tenha pelo menos um tier "aberto" (maxCost=null)
    if (!next.some(t => t.maxCost === null)) {
      next.push({ maxCost: null, marginPercent: 0.4 })
    }
    setData({ ...data, marginTiers: next })
  }

  function addTier() {
    if (!data) return
    // Insere antes do tier final (maxCost=null), com sugestao baseada na maior maxCost existente
    const finite = data.marginTiers.filter(t => t.maxCost !== null)
    const highestFinite = finite.reduce((max, t) => Math.max(max, t.maxCost ?? 0), 0)
    const novo: Tier = { maxCost: highestFinite + 50, marginPercent: 0.5 }
    const next = [...finite, novo, { maxCost: null as null, marginPercent: 0.4 }]
    // Ordena por maxCost asc (null ao final)
    next.sort((a, b) => {
      if (a.maxCost === null) return 1
      if (b.maxCost === null) return -1
      return a.maxCost - b.maxCost
    })
    setData({ ...data, marginTiers: next })
  }

  if (loading) {
    return <p style={{ color: '#6B7494' }}>Carregando...</p>
  }
  if (!data) {
    return (
      <div style={{ ...CARD, color: '#B42318' }}>
        Não foi possível carregar as configurações.
        {feedback && <p style={{ marginTop: '8px' }}>{feedback.text}</p>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link
          href="/admin"
          style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}
        >
          ← Painel
        </Link>
      </div>

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
          Configurações
        </p>
        <h1
          style={{
            fontSize: 'clamp(26px, 3vw, 34px)',
            color: '#1D2235',
            margin: '6px 0 4px',
          }}
        >
          Precificação
        </h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          Defaults globais usados pela calculadora de orçamentos e precificação de
          produtos. Ajuste fino vive em cada orçamento/produto.
        </p>
      </header>

      {feedback && (
        <div
          style={{
            background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2',
            color: feedback.kind === 'ok' ? '#166534' : '#B42318',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
          }}
        >
          {feedback.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px', maxWidth: '760px' }}>
        {/* Seção 1: Defaults operacionais */}
        <section style={CARD}>
          <h2 style={{ margin: '0 0 12px', fontSize: '17px', color: '#1D2235' }}>
            Defaults operacionais
          </h2>

          <div
            style={{
              display: 'grid',
              gap: '14px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div>
              <label style={LABEL}>Tarifa de energia (R$/kWh)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={data.energyTariffPerKwh}
                onChange={e =>
                  updateField('energyTariffPerKwh', Number(e.target.value))
                }
                style={INPUT}
              />
            </div>
            <div>
              <label style={LABEL}>Energia default (R$/h)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.defaultEnergyCostPerHour}
                onChange={e =>
                  updateField('defaultEnergyCostPerHour', Number(e.target.value))
                }
                style={INPUT}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
                Usado quando a impressora não tem consumo (watts) cadastrado.
              </p>
            </div>
            <div>
              <label style={LABEL}>Depreciação default (R$/h)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.defaultDepreciationPerHour}
                onChange={e =>
                  updateField('defaultDepreciationPerHour', Number(e.target.value))
                }
                style={INPUT}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
                Usado quando a impressora não tem custo/horas-de-vida cadastrados.
              </p>
            </div>
            <div>
              <label style={LABEL}>Taxa de erro padrão (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={(data.defaultErrorRate * 100).toFixed(2)}
                onChange={e =>
                  updateField('defaultErrorRate', Number(e.target.value) / 100)
                }
                style={INPUT}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
                Aplicada sobre o custo do filamento.
              </p>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() =>
                save({
                  energyTariffPerKwh: data.energyTariffPerKwh,
                  defaultEnergyCostPerHour: data.defaultEnergyCostPerHour,
                  defaultDepreciationPerHour: data.defaultDepreciationPerHour,
                  defaultErrorRate: data.defaultErrorRate,
                })
              }
              disabled={saving}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#1D2235',
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar defaults'}
            </button>
          </div>
        </section>

        {/* Seção 2: Faixas de margem */}
        <section style={CARD}>
          <h2 style={{ margin: '0 0 4px', fontSize: '17px', color: '#1D2235' }}>
            Faixas de margem sugerida
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6B7494' }}>
            A calculadora sugere a margem baseada no custo total do orçamento. Use estas
            faixas como ponto de partida — admin sempre pode sobrescrever em cada caso.
          </p>

          <div style={{ display: 'grid', gap: '8px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: '12px',
                padding: '8px 12px',
                background: '#F0F5FB',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#4A7AB5',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <span>Custo até</span>
              <span>Margem sugerida</span>
              <span style={{ width: '60px' }}></span>
            </div>

            {data.marginTiers.map((tier, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#F9FBFD',
                  borderRadius: '8px',
                }}
              >
                {tier.maxCost === null ? (
                  <span style={{ color: '#6B7494', fontSize: '14px', fontStyle: 'italic' }}>
                    Acima de tudo
                  </span>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tier.maxCost}
                    onChange={e =>
                      updateTier(idx, { maxCost: Number(e.target.value) })
                    }
                    style={INPUT}
                  />
                )}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={(tier.marginPercent * 100).toFixed(2)}
                  onChange={e =>
                    updateTier(idx, { marginPercent: Number(e.target.value) / 100 })
                  }
                  style={INPUT}
                />
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  disabled={saving || data.marginTiers.length <= 1}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #FCA5A5',
                    background: 'white',
                    color: '#B42318',
                    cursor: data.marginTiers.length <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    minWidth: '60px',
                  }}
                  title={tier.maxCost === null ? 'Faixa final aberta (necessária)' : 'Remover faixa'}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={addTier}
              disabled={saving}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #4A7AB5',
                background: 'white',
                color: '#4A7AB5',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              + Adicionar faixa
            </button>
            <button
              type="button"
              onClick={() => save({ marginTiers: data.marginTiers })}
              disabled={saving}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#1D2235',
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar faixas'}
            </button>
          </div>

          <div
            style={{
              marginTop: '14px',
              background: '#F0F5FB',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#4A7AB5',
            }}
          >
            <strong style={{ color: '#1D2235' }}>Exemplo:</strong> com custo total de{' '}
            {formatBRL(30)} e as faixas atuais, a sugestão de margem seria{' '}
            <strong>
              {(
                (data.marginTiers
                  .slice()
                  .sort((a, b) => {
                    if (a.maxCost === null) return 1
                    if (b.maxCost === null) return -1
                    return a.maxCost - b.maxCost
                  })
                  .find(t => t.maxCost === null || 30 <= t.maxCost)?.marginPercent ?? 0.4) *
                100
              ).toFixed(0)}
              %
            </strong>
            .
          </div>
        </section>

        {data.updatedAt && (
          <p style={{ fontSize: '12px', color: '#A8AFCA', textAlign: 'right', margin: 0 }}>
            Última alteração: {new Date(data.updatedAt).toLocaleString('pt-BR')}
            {data.updatedByEmail ? ` por ${data.updatedByEmail}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
