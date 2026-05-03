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

  const isLocked = campaign.status === 'sending' || campaign.status === 'sent'

  return (
    <div>
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
      {!isLocked && (
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            {deleting ? 'Excluindo...' : 'Excluir campanha'}
          </button>
        </div>
      )}
    </div>
  )
}

function ReadOnlyView({ campaign }: { campaign: Campaign }) {
  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link href="/admin/emails/campanhas" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Voltar para campanhas</Link>
      </div>
      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Comunicação</p>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#1D2235', margin: '6px 0 4px' }}>{campaign.name}</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>Esta campanha está em envio ou já foi enviada — visualização somente leitura.</p>
      </header>
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
