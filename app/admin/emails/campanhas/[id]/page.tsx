'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import CampaignForm, { type CampaignFormValues } from '../CampaignForm'

type Campaign = {
  id: string
  name: string
  subject: string
  htmlBody: string
  textBody: string | null
  segment: CampaignFormValues['segment']
  status: string
  scheduledAt: string | null
  recipientCount: number
  sentCount: number
  failedCount: number
  createdAt: string
}

export default function EditarCampanhaPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Campanha não encontrada.')
        return
      }
      setCampaign(await res.json())
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) load()
  }, [id, load])

  // Poll a cada 3s enquanto a campanha está em envio — UI vê o progresso.
  useEffect(() => {
    if (!campaign || campaign.status !== 'sending') return
    const handle = window.setInterval(() => {
      fetch(`/api/admin/email-campaigns/${id}`, { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data) setCampaign(data)
        })
        .catch(() => {})
    }, 3000)
    return () => window.clearInterval(handle)
  }, [campaign, id])

  async function handleDispatch() {
    if (!campaign) return
    const recipientsHint = campaign.recipientCount > 0 ? ` para ${campaign.recipientCount} pessoas` : ''
    if (!window.confirm(`Disparar a campanha "${campaign.name}"${recipientsHint} agora? Esta ação não pode ser desfeita.`)) return
    setDispatching(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/dispatch`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (res.status === 202) {
        setFeedback({ kind: 'ok', text: 'Disparo iniciado. Acompanhe o progresso abaixo.' })
        load()
      } else {
        setFeedback({ kind: 'err', text: data?.error || 'Erro ao disparar.' })
      }
    } catch {
      setFeedback({ kind: 'err', text: 'Erro de conexão.' })
    } finally {
      setDispatching(false)
    }
  }

  async function handleDelete() {
    if (!campaign) return
    if (!window.confirm(`Excluir a campanha "${campaign.name}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Erro ao excluir.')
        return
      }
      router.push('/admin/emails/campanhas')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Link href="/admin/emails/campanhas" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar</Link>
        <p style={{ marginTop: '24px', color: '#6B7494' }}>Carregando campanha...</p>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div>
        <Link href="/admin/emails/campanhas" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar</Link>
        <p style={{ marginTop: '24px', color: '#B42318' }}>{error || 'Campanha não encontrada.'}</p>
      </div>
    )
  }

  const isLocked = campaign.status === 'sending' || campaign.status === 'sent' || campaign.status === 'failed'
  const canDispatch = campaign.status === 'draft' || campaign.status === 'scheduled'

  return (
    <div>
      {feedback && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: feedback.kind === 'ok' ? '#166534' : '#B42318' }}>
          {feedback.text}
        </div>
      )}

      {isLocked ? (
        <ReadOnlyView campaign={campaign} />
      ) : (
        <CampaignForm
          initial={{
            id: campaign.id,
            name: campaign.name,
            subject: campaign.subject,
            htmlBody: campaign.htmlBody,
            textBody: campaign.textBody || '',
            segment: campaign.segment,
            scheduledAt: campaign.scheduledAt as unknown as string,
          }}
          onSaved={() => load()}
        />
      )}

      <div style={{ marginTop: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {canDispatch && (
          <button
            onClick={handleDispatch}
            disabled={dispatching}
            style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1D7A72', color: 'white', fontWeight: 600, cursor: dispatching ? 'not-allowed' : 'pointer', opacity: dispatching ? 0.7 : 1 }}
          >
            {dispatching ? 'Iniciando...' : 'Disparar agora'}
          </button>
        )}
        {!isLocked && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            {deleting ? 'Excluindo...' : 'Excluir campanha'}
          </button>
        )}
      </div>
    </div>
  )
}

function ReadOnlyView({ campaign }: { campaign: Campaign }) {
  const progress = campaign.recipientCount > 0
    ? Math.min(100, Math.round(((campaign.sentCount + campaign.failedCount) / campaign.recipientCount) * 100))
    : 0
  const isSending = campaign.status === 'sending'

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link href="/admin/emails/campanhas" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar para campanhas</Link>
      </div>
      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Comunicação</p>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#1D2235', margin: '6px 0 4px' }}>{campaign.name}</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          {isSending ? 'Em envio — esta página atualiza sozinha enquanto a campanha roda.' : 'Visualização somente leitura.'}
        </p>
      </header>

      {campaign.recipientCount > 0 && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '10px' }}>
            <strong style={{ color: '#1D2235' }}>Progresso</strong>
            <span style={{ color: '#6B7494', fontSize: '14px' }}>{progress}% concluído</span>
          </div>
          <div style={{ height: '10px', borderRadius: '999px', background: '#E4EDF8', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: campaign.status === 'failed' ? '#B42318' : '#1D7A72',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <p style={{ margin: '10px 0 0', color: '#6B7494', fontSize: '14px' }}>
            {campaign.sentCount} enviados · {campaign.failedCount} falhas · {campaign.recipientCount} destinatários
          </p>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <dl style={{ display: 'grid', gap: '12px', margin: 0 }}>
          <div>
            <dt style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Assunto</dt>
            <dd style={{ margin: '4px 0 0', color: '#1D2235' }}>{campaign.subject}</dd>
          </div>
          <div>
            <dt style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</dt>
            <dd style={{ margin: '4px 0 0', color: '#1D2235' }}>{campaign.status}</dd>
          </div>
          <div>
            <dt style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Envios</dt>
            <dd style={{ margin: '4px 0 0', color: '#1D2235' }}>
              {campaign.sentCount}/{campaign.recipientCount} concluídos · {campaign.failedCount} falhas
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
