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
  const [mode, setMode] = useState<'code' | 'password'>('code')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
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

  async function loginWithPassword(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const response = await fetch('/api/auth/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Nao foi possivel entrar com senha.')
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
          Use codigo por e-mail para clientes ou senha para acessar a area administrativa.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => { setMode('code'); setError(''); setMessage('') }}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: mode === 'code' ? '2px solid #1D2235' : '1px solid #BBCFEB',
              backgroundColor: mode === 'code' ? '#F0F5FB' : 'white',
              color: '#1D2235',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Codigo por e-mail
          </button>
          <button
            type="button"
            onClick={() => { setMode('password'); setError(''); setMessage('') }}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: mode === 'password' ? '2px solid #1D2235' : '1px solid #BBCFEB',
              backgroundColor: mode === 'password' ? '#F0F5FB' : 'white',
              color: '#1D2235',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            E-mail e senha
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={loginWithPassword} style={{ display: 'grid', gap: '16px' }}>
            <Input label="E-mail" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required aria-required="true" />
            <Input label="Senha" name="password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required aria-required="true" />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar com senha'}
            </Button>
          </form>
        ) : step === 'email' ? (
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
