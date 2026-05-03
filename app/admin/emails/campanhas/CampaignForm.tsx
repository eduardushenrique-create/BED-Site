'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import HtmlEditor from '@/components/HtmlEditor'

type Segment =
  | { type: 'all' }
  | { type: 'paid_recent'; lastDays: number }
  | { type: 'top_spenders'; limit: number }
  | { type: 'has_wishlist' }

export type CampaignFormValues = {
  id?: string
  name: string
  subject: string
  htmlBody: string
  textBody: string
  segment: Segment
  scheduledAt: string // datetime-local string ('' = sem agendamento)
}

const EMPTY: CampaignFormValues = {
  name: '',
  subject: '',
  htmlBody: '',
  textBody: '',
  segment: { type: 'all' },
  scheduledAt: '',
}

interface Props {
  initial?: Partial<CampaignFormValues>
  onSaved?: (campaign: { id: string }) => void
}

function toLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return ''
    const offsetMs = d.getTimezoneOffset() * 60 * 1000
    const local = new Date(d.getTime() - offsetMs)
    return local.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

export default function CampaignForm({ initial, onSaved }: Props) {
  const [values, setValues] = useState<CampaignFormValues>({
    ...EMPTY,
    ...initial,
    scheduledAt: toLocalDateTimeInput(initial?.scheduledAt as string | null | undefined) || '',
  })
  const [preview, setPreview] = useState<{
    description: string
    total: number
    sampled: { email: string; name: string | null }[]
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Auto-preview do segmento sempre que muda.
  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError('')
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/email-campaigns/preview-segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment: values.segment }),
        })
        if (cancelled) return
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setPreviewError(data?.error || 'Erro ao calcular segmento.')
          setPreview(null)
          return
        }
        setPreview(data)
      } catch {
        if (!cancelled) {
          setPreviewError('Erro de conexão.')
          setPreview(null)
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [values.segment])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        subject: values.subject.trim(),
        htmlBody: values.htmlBody.trim(),
        textBody: values.textBody.trim() || null,
        segment: values.segment,
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : null,
      }

      const url = values.id
        ? `/api/admin/email-campaigns/${values.id}`
        : '/api/admin/email-campaigns'
      const method = values.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFeedback({ kind: 'err', text: data?.error || 'Erro ao salvar.' })
        return
      }
      setFeedback({ kind: 'ok', text: 'Campanha salva.' })
      onSaved?.(data)
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link href="/admin/emails/campanhas" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar para campanhas</Link>
      </div>

      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Comunicação</p>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#1D2235', margin: '6px 0 4px' }}>{values.id ? 'Editar campanha' : 'Nova campanha'}</h1>
      </header>

      {feedback && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: feedback.kind === 'ok' ? '#166534' : '#B42318' }}>
          {feedback.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: '20px', alignItems: 'start' }}>
        <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
          <Field label="Nome interno (não vai no e-mail)">
            <input
              value={values.name}
              onChange={e => setValues({ ...values, name: e.target.value })}
              required
              placeholder="Ex.: Black Friday 2026"
              style={inputStyle}
            />
          </Field>

          <Field label="Assunto">
            <input
              value={values.subject}
              onChange={e => setValues({ ...values, subject: e.target.value })}
              required
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '14px', color: '#1D2235', fontWeight: 600 }}>HTML do e-mail</label>
            <HtmlEditor
              value={values.htmlBody}
              onChange={html => setValues({ ...values, htmlBody: html })}
              minHeight={340}
              placeholder="Use Visual para escrever, ou HTML para colar um e-mail marketing pronto."
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
              O link de descadastro é adicionado automaticamente no rodapé.
            </p>
          </div>

          <Field label="Texto puro (opcional)">
            <textarea
              value={values.textBody}
              onChange={e => setValues({ ...values, textBody: e.target.value })}
              rows={4}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '13px' }}
              placeholder="Versão sem HTML, usada por clientes antigos."
            />
          </Field>

          <SegmentField segment={values.segment} onChange={segment => setValues({ ...values, segment })} />

          <Field label="Agendar envio (opcional)">
            <input
              type="datetime-local"
              value={values.scheduledAt}
              onChange={e => setValues({ ...values, scheduledAt: e.target.value })}
              style={inputStyle}
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
              Sem data: salva como rascunho. Com data: marca como agendada (envio automático será habilitado em breve).
            </p>
          </Field>

          <div>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando...' : values.id ? 'Salvar alterações' : 'Criar campanha'}
            </button>
          </div>
        </form>

        <aside style={{ position: 'sticky', top: '32px', display: 'grid', gap: '16px' }}>
          <section style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1D2235' }}>Pré-visualização do segmento</h2>
            {previewLoading && <p style={{ margin: 0, fontSize: '13px', color: '#6B7494' }}>Calculando...</p>}
            {previewError && <p style={{ margin: 0, fontSize: '13px', color: '#B42318' }}>{previewError}</p>}
            {!previewLoading && !previewError && preview && (
              <>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6B7494' }}>{preview.description}</p>
                <p style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 700, color: '#1D2235' }}>
                  {preview.total} {preview.total === 1 ? 'destinatário' : 'destinatários'}
                </p>
                {preview.sampled.length > 0 && (
                  <>
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>Amostra:</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '4px' }}>
                      {preview.sampled.map(s => (
                        <li key={s.email} style={{ fontSize: '12px', color: '#1D2235' }}>
                          {s.name ? `${s.name} · ` : ''}<span style={{ color: '#6B7494' }}>{s.email}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>

          <section style={{ background: '#F0F5FB', borderRadius: '14px', padding: '14px', fontSize: '12px', color: '#4A7AB5' }}>
            <strong style={{ color: '#1D2235' }}>LGPD:</strong> o link de descadastro é obrigatório no rodapé e é injetado automaticamente. Quem se descadastra entra na tabela <code>EmailUnsubscribe</code> e fica de fora de TODAS as próximas campanhas (a contagem do segmento já desconta).
          </section>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '6px', fontSize: '14px', color: '#1D2235', fontWeight: 600 }}>
      {label}
      {children}
    </label>
  )
}

function SegmentField({ segment, onChange }: { segment: Segment; onChange: (s: Segment) => void }) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <label style={{ fontSize: '14px', color: '#1D2235', fontWeight: 600 }}>Quem recebe</label>
      <select
        value={segment.type}
        onChange={e => {
          const type = e.target.value as Segment['type']
          if (type === 'all') onChange({ type: 'all' })
          else if (type === 'has_wishlist') onChange({ type: 'has_wishlist' })
          else if (type === 'paid_recent') onChange({ type: 'paid_recent', lastDays: 60 })
          else if (type === 'top_spenders') onChange({ type: 'top_spenders', limit: 50 })
        }}
        style={inputStyle}
      >
        <option value="all">Todos os clientes verificados</option>
        <option value="paid_recent">Clientes com pedido pago nos últimos N dias</option>
        <option value="top_spenders">Top N clientes por valor de compras</option>
        <option value="has_wishlist">Clientes com itens na wishlist</option>
      </select>
      {segment.type === 'paid_recent' && (
        <input
          type="number"
          min={1}
          max={365}
          value={segment.lastDays}
          onChange={e => onChange({ type: 'paid_recent', lastDays: Number(e.target.value) || 60 })}
          style={inputStyle}
        />
      )}
      {segment.type === 'top_spenders' && (
        <input
          type="number"
          min={1}
          max={500}
          value={segment.limit}
          onChange={e => onChange({ type: 'top_spenders', limit: Number(e.target.value) || 50 })}
          style={inputStyle}
        />
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  fontFamily: 'inherit',
  width: '100%',
}
