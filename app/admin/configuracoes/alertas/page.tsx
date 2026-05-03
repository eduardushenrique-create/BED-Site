'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type AlertSettings = {
  lowStockEmails: string[]
  orderAlertEmails: string[]
  updatedAt: string | null
}

export default function AlertSettingsPage() {
  const [settings, setSettings] = useState<AlertSettings>({
    lowStockEmails: [],
    orderAlertEmails: [],
    updatedAt: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [lowInput, setLowInput] = useState('')
  const [orderInput, setOrderInput] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/alertas', { cache: 'no-store' })
      if (!res.ok) {
        setFeedback({ kind: 'err', text: 'Erro ao carregar.' })
        return
      }
      setSettings(await res.json())
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(updated: AlertSettings) {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/configuracoes/alertas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lowStockEmails: updated.lowStockEmails,
          orderAlertEmails: updated.orderAlertEmails,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFeedback({ kind: 'err', text: data?.error || 'Erro ao salvar.' })
        return
      }
      setSettings(data)
      setFeedback({ kind: 'ok', text: 'Configuração salva.' })
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  function addEmail(list: 'low' | 'order') {
    const value = (list === 'low' ? lowInput : orderInput).trim().toLowerCase()
    if (!value) return
    const target = list === 'low' ? settings.lowStockEmails : settings.orderAlertEmails
    if (target.includes(value)) {
      setFeedback({ kind: 'err', text: 'Esse e-mail já está na lista.' })
      return
    }
    const updated: AlertSettings = {
      ...settings,
      [list === 'low' ? 'lowStockEmails' : 'orderAlertEmails']: [...target, value],
    }
    setSettings(updated)
    if (list === 'low') setLowInput('')
    else setOrderInput('')
    save(updated)
  }

  function removeEmail(list: 'low' | 'order', email: string) {
    const target = list === 'low' ? settings.lowStockEmails : settings.orderAlertEmails
    const updated: AlertSettings = {
      ...settings,
      [list === 'low' ? 'lowStockEmails' : 'orderAlertEmails']: target.filter(e => e !== email),
    }
    setSettings(updated)
    save(updated)
  }

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link href="/admin/componentes" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Componentes</Link>
      </div>

      <header style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Configurações</p>
        <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: '#1D2235', margin: '6px 0 4px' }}>Alertas de estoque</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          Quem recebe e-mail quando algum componente fica abaixo do limite, ou quando um pedido entra precisando de componente que falta.
        </p>
      </header>

      {feedback && (
        <div style={{ background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: feedback.kind === 'ok' ? '#166534' : '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
          {feedback.text}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <EmailListSection
            title="Alerta de estoque baixo"
            description="Disparado quando um componente atinge o limite mínimo configurado."
            emails={settings.lowStockEmails}
            input={lowInput}
            setInput={setLowInput}
            onAdd={() => addEmail('low')}
            onRemove={email => removeEmail('low', email)}
            disabled={saving}
          />

          <EmailListSection
            title="Alerta proativo de pedido"
            description="Disparado quando um pedido entra precisando de componente sem estoque suficiente. O pedido NÃO é bloqueado — só recebemos o aviso para repor."
            emails={settings.orderAlertEmails}
            input={orderInput}
            setInput={setOrderInput}
            onAdd={() => addEmail('order')}
            onRemove={email => removeEmail('order', email)}
            disabled={saving}
          />

          <div style={{ background: '#F0F5FB', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', color: '#4A7AB5' }}>
            <strong style={{ color: '#1D2235' }}>Sem nenhum e-mail cadastrado?</strong> O sistema usa <code>{process.env.NEXT_PUBLIC_RESEND_REPLY_TO_EMAIL || 'eduardus.henrique@gmail.com'}</code> como destinatário fallback para não ficar em silêncio.
          </div>
        </div>
      )}
    </div>
  )
}

function EmailListSection({
  title,
  description,
  emails,
  input,
  setInput,
  onAdd,
  onRemove,
  disabled,
}: {
  title: string
  description: string
  emails: string[]
  input: string
  setInput: (s: string) => void
  onAdd: () => void
  onRemove: (email: string) => void
  disabled: boolean
}) {
  return (
    <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '17px' }}>{title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6B7494' }}>{description}</p>

      {emails.length === 0 ? (
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#A8AFCA' }}>Nenhum e-mail cadastrado.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: '6px' }}>
          {emails.map(email => (
            <li key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FBFD', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '14px', color: '#1D2235' }}>{email}</span>
              <button
                type="button"
                onClick={() => onRemove(email)}
                disabled={disabled}
                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={e => {
          e.preventDefault()
          onAdd()
        }}
        style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
      >
        <input
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="email@exemplo.com"
          required
          style={{ flex: 1, minWidth: '220px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', fontSize: '14px' }}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D2235', color: 'white', fontWeight: 600, cursor: disabled || !input.trim() ? 'not-allowed' : 'pointer' }}
        >
          + Adicionar
        </button>
      </form>
    </section>
  )
}
