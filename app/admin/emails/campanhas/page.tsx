'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Campaign = {
  id: string
  name: string
  subject: string
  status: string
  scheduledAt: string | null
  sentCount: number
  recipientCount: number
  failedCount: number
  createdAt: string
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

const STATUS_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Rascunho', bg: '#E4EDF8', fg: '#4A7AB5' },
  scheduled: { label: 'Agendada', bg: '#FEF3C7', fg: '#92400E' },
  sending: { label: 'Enviando', bg: '#FEF3C7', fg: '#92400E' },
  sent: { label: 'Enviada', bg: '#DCFCE7', fg: '#166534' },
  failed: { label: 'Falhou', bg: '#FEE2E2', fg: '#B42318' },
  cancelled: { label: 'Cancelada', bg: '#F3F4F6', fg: '#6B7494' },
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/email-campaigns', { cache: 'no-store' })
      if (!res.ok) {
        setError('Não foi possível carregar campanhas.')
        return
      }
      const data = await res.json()
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : [])
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link href="/admin/emails" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Templates de e-mail</Link>
      </div>

      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Comunicação</p>
          <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: '#1D2235', margin: '6px 0 4px' }}>Campanhas de e-mail</h1>
          <p style={{ color: '#6B7494', margin: 0 }}>
            Disparos promocionais para a base de clientes. Em breve também o envio em massa será automático — por enquanto, criar a campanha já registra o segmento e o conteúdo.
          </p>
        </div>
        <Link
          href="/admin/emails/campanhas/nova"
          style={{ padding: '10px 18px', borderRadius: '10px', background: '#1D2235', color: 'white', textDecoration: 'none', fontWeight: 600 }}
        >
          + Nova campanha
        </Link>
      </header>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando campanhas...</p>
      ) : campaigns.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#6B7494', marginBottom: '12px' }}>Nenhuma campanha criada ainda.</p>
          <Link href="/admin/emails/campanhas/nova" style={{ color: '#4A7AB5', fontWeight: 600 }}>Criar a primeira campanha</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {campaigns.map(c => {
            const statusMeta = STATUS_LABELS[c.status] || STATUS_LABELS.draft
            return (
              <Link
                key={c.id}
                href={`/admin/emails/campanhas/${c.id}`}
                style={{
                  display: 'block',
                  background: 'white',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '17px', color: '#1D2235' }}>{c.name}</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6B7494' }}>{c.subject}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#A8AFCA' }}>
                      Criada em {formatDate(c.createdAt)}
                      {c.scheduledAt && ` · agendada para ${formatDate(c.scheduledAt)}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span style={{ background: statusMeta.bg, color: statusMeta.fg, borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
                      {statusMeta.label}
                    </span>
                    {c.recipientCount > 0 && (
                      <span style={{ fontSize: '12px', color: '#6B7494' }}>
                        {c.sentCount}/{c.recipientCount} enviados
                        {c.failedCount > 0 && ` · ${c.failedCount} falhas`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
