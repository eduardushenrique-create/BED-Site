'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'

export default function DescadastrarClient() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const token = searchParams.get('token') || ''

  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!email || !token) {
      setError('Link inválido. Use o link enviado no e-mail.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, reason: reason || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Não foi possível concluir.')
        return
      }
      setDone(true)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '600px' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Comunicação</p>
        <h1 style={{ fontSize: '28px', color: '#1D2235', margin: '8px 0' }}>Descadastrar</h1>
        <p style={{ color: '#6B7494', marginBottom: '24px' }}>
          Confirme o descadastro abaixo. Você não receberá mais nossos e-mails promocionais. E-mails sobre pedidos que você fizer continuam sendo enviados normalmente.
        </p>

        {!email || !token ? (
          <div style={{ background: '#FEE2E2', borderRadius: '10px', padding: '16px', color: '#B42318' }}>
            Link inválido ou ausente. Use o link de descadastro do rodapé do e-mail recebido.
          </div>
        ) : done ? (
          <div style={{ background: '#DCFCE7', borderRadius: '10px', padding: '20px', color: '#166534' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Descadastro confirmado.</p>
            <p style={{ margin: 0 }}>Você não receberá mais e-mails promocionais.</p>
            <p style={{ margin: '12px 0 0' }}>
              <Link href="/" style={{ color: '#166534', fontWeight: 600 }}>← Voltar para a loja</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ background: '#F9FBFD', padding: '12px 14px', borderRadius: '10px', fontSize: '14px', color: '#1D2235' }}>
              <strong>E-mail:</strong> {email}
            </div>
            <label style={{ display: 'grid', gap: '6px', fontSize: '14px', color: '#1D2235' }}>
              Motivo (opcional)
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="Conte por que está saindo — nos ajuda a melhorar."
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Processando...' : 'Confirmar descadastro'}
            </Button>
            <Link href="/" style={{ color: '#4A7AB5', fontSize: '14px', textAlign: 'center', textDecoration: 'none' }}>
              ← Cancelar e voltar
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
