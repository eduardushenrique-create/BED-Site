'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import Input from '@/components/Input'

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = useMemo(() => searchParams.get('redirect') || '/checkout', [searchParams])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function requestCode(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const response = await fetch('/api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Nao foi possivel enviar o codigo.')
      return
    }

    setStep('code')
    setMessage(data.message || 'Codigo enviado para o seu e-mail.')
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, name }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Codigo invalido.')
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '520px' }}>
      <Link href="/" style={{ color: '#1D2235', fontWeight: 600 }}>Voltar para a loja</Link>
      <section style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '34px', color: '#1D2235', marginBottom: '8px' }}>
          Entrar ou criar conta
        </h1>
        <p style={{ color: '#5F6678', marginBottom: '24px' }}>
          Enviaremos um codigo unico para confirmar seu e-mail antes de finalizar a compra.
        </p>

        {step === 'email' ? (
          <form onSubmit={requestCode} style={{ display: 'grid', gap: '16px' }}>
            <Input label="Nome completo" name="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" />
            <Input label="E-mail" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required aria-required="true" />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Enviando...' : 'Receber codigo por e-mail'}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} style={{ display: 'grid', gap: '16px' }}>
            {message && <p role="status" style={{ color: '#1D7A72', margin: 0 }}>{message}</p>}
            <Input label="Codigo de acesso" name="code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required aria-required="true" />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Validando...' : 'Entrar'}
            </Button>
            <button type="button" onClick={() => setStep('email')} style={{ border: 'none', background: 'transparent', color: '#1D2235', cursor: 'pointer', fontWeight: 600 }}>
              Usar outro e-mail
            </button>
          </form>
        )}

        <div style={{ borderTop: '1px solid #E3E9F4', marginTop: '24px', paddingTop: '24px' }}>
          <a href={`/api/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`} style={{ display: 'block', textAlign: 'center', padding: '12px 16px', border: '1px solid #BBCFEB', borderRadius: '8px', color: '#1D2235', fontWeight: 700 }}>
            Entrar com Google
          </a>
        </div>
      </section>
    </main>
  )
}
