'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import HtmlEditor from '@/components/HtmlEditor'

type Variable = { name: string; description: string; example: string }

type TemplateDetail = {
  slug: string
  label: string
  description: string
  variables: Variable[]
  defaults: { subject: string; htmlBody: string; textBody: string | null }
  override: {
    subject: string
    htmlBody: string
    textBody: string | null
    isActive: boolean
    updatedAt: string
  } | null
}

export default function AdminEmailTemplatePage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [detail, setDetail] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [textBody, setTextBody] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/email-templates/${slug}`, { cache: 'no-store' })
      if (!res.ok) {
        setFeedback({ kind: 'err', text: 'Template não encontrado.' })
        return
      }
      const data: TemplateDetail = await res.json()
      setDetail(data)
      const source = data.override ?? data.defaults
      setSubject(source.subject)
      setHtmlBody(source.htmlBody)
      setTextBody(source.textBody ?? '')
      setIsActive(data.override?.isActive ?? true)
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (slug) load()
  }, [slug, load])

  async function refreshPreview() {
    try {
      const res = await fetch(`/api/admin/email-templates/${slug}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, htmlBody, textBody: textBody || null }),
      })
      if (!res.ok) return
      const data = await res.json()
      setPreviewHtml(data.html || '')
      setPreviewSubject(data.subject || '')
    } catch {
      // silencioso — preview é best effort
    }
  }

  useEffect(() => {
    if (!detail) return
    const id = window.setTimeout(refreshPreview, 350)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, htmlBody, textBody, detail])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/email-templates/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, htmlBody, textBody: textBody || null, isActive }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFeedback({ kind: 'err', text: data?.error || 'Erro ao salvar.' })
        return
      }
      setFeedback({ kind: 'ok', text: 'Template salvo. Próximos e-mails já usam essa versão.' })
      load()
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!detail?.override) return
    if (!window.confirm('Restaurar o padrão do sistema? A customização será perdida.')) return
    setResetting(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/email-templates/${slug}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setFeedback({ kind: 'err', text: data?.error || 'Erro ao restaurar.' })
        return
      }
      setFeedback({ kind: 'ok', text: 'Template restaurado para o padrão.' })
      load()
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Link href="/admin/emails" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar</Link>
        <p style={{ marginTop: '24px', color: '#6B7494' }}>Carregando template...</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div>
        <Link href="/admin/emails" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar</Link>
        <p style={{ marginTop: '24px', color: '#B42318' }}>Template não encontrado.</p>
      </div>
    )
  }

  return (
    <div>
      <Link href="/admin/emails" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar para templates</Link>

      <header style={{ marginTop: '12px', marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Template</p>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#1D2235', margin: '6px 0 4px' }}>{detail.label}</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>{detail.description}</p>
      </header>

      {feedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2',
          color: feedback.kind === 'ok' ? '#166534' : '#B42318',
        }}>
          {feedback.text}
        </div>
      )}

      <div className="admin-detail-grid" style={{ gap: '20px', alignItems: 'start' }}>
        <form onSubmit={handleSave} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '14px', color: '#1D2235', fontWeight: 600 }}>
            Assunto
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', fontSize: '14px' }}
            />
          </label>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '14px', color: '#1D2235', fontWeight: 600 }}>HTML</label>
            <HtmlEditor
              value={htmlBody}
              onChange={setHtmlBody}
              minHeight={360}
              placeholder="Edite visualmente ou troque para HTML para colar o código completo."
            />
          </div>

          <label style={{ display: 'grid', gap: '6px', fontSize: '14px', color: '#1D2235', fontWeight: 600 }}>
            Texto puro (opcional)
            <textarea
              value={textBody}
              onChange={e => setTextBody(e.target.value)}
              rows={5}
              placeholder="Versão sem HTML, usada por clientes de e-mail antigos. Deixe em branco para omitir."
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid #D8DCE8', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1D2235' }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
            />
            Template ativo (desmarcar volta ao padrão sem perder a customização salva)
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando...' : 'Salvar template'}
            </button>
            {detail.override && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#B42318', fontWeight: 600, cursor: resetting ? 'not-allowed' : 'pointer' }}
              >
                {resetting ? 'Restaurando...' : 'Restaurar padrão'}
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/admin/emails')}
              style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#1D2235', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </form>

        <aside style={{ display: 'grid', gap: '16px', position: 'sticky', top: '32px' }}>
          <section style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1D2235' }}>Variáveis disponíveis</h2>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6B7494' }}>
              Use no formato <code style={{ background: '#F0F5FB', padding: '0 4px', borderRadius: '4px' }}>{'{{nomeDaVariavel}}'}</code>.
              Para HTML cru já gerado pelo sistema (ex.: linhas de itens), use <code style={{ background: '#F0F5FB', padding: '0 4px', borderRadius: '4px' }}>{'{{raw.itemsHtml}}'}</code>.
            </p>
            <div style={{ display: 'grid', gap: '8px' }}>
              {detail.variables.map(v => (
                <div key={v.name} style={{ background: '#F9FBFD', borderRadius: '8px', padding: '8px 10px' }}>
                  <code style={{ fontSize: '12px', color: '#1D2235', fontWeight: 600 }}>{`{{${v.name}}}`}</code>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7494' }}>{v.description}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#A8AFCA' }}>Ex.: {v.example}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1D2235' }}>Pré-visualização</h2>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6B7494' }}>
              <strong>Assunto:</strong> {previewSubject || subject}
            </p>
            <iframe
              title="Pré-visualização do e-mail"
              srcDoc={previewHtml || htmlBody}
              sandbox=""
              style={{ width: '100%', height: '320px', border: '1px solid #E3E9F4', borderRadius: '10px', background: 'white' }}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
