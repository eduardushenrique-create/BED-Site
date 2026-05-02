'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import Input from '@/components/Input'

type Tab = 'login' | 'signup'
type Mode = 'code' | 'password'

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = useMemo(() => searchParams.get('redirect') || '/minha-conta', [searchParams])
  const initialTab = (searchParams.get('tab') as Tab) || 'login'

  const [tab, setTab] = useState<Tab>(initialTab)
  const [mode, setMode] = useState<Mode>('code')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
        cooldownTimerRef.current = null
      }
      return
    }
    if (cooldownTimerRef.current) return
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
        cooldownTimerRef.current = null
      }
    }
  }, [cooldownSeconds])

  function resetMessages() {
    setError('')
    setMessage('')
  }

  function handleRateLimit(response: Response, fallbackError: string) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 0
    if (retryAfter > 0) {
      setCooldownSeconds(retryAfter)
    }
    setError(fallbackError)
  }

  function formatCooldown(seconds: number) {
    if (seconds <= 0) return ''
    if (seconds < 60) return `Aguarde ${seconds}s`
    const minutes = Math.ceil(seconds / 60)
    return `Aguarde ${minutes} min`
  }

  const isCoolingDown = cooldownSeconds > 0
  const submitDisabled = loading || isCoolingDown

  async function requestCode(event: React.FormEvent) {
    event.preventDefault()
    if (tab === 'signup' && (!name.trim() || name.trim().length < 2)) {
      setError('Informe seu nome completo.')
      return
    }
    setLoading(true)
    resetMessages()

    const response = await fetch('/api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      const fallback = data.error || 'Não foi possível enviar o código.'
      if (response.status === 429) {
        handleRateLimit(response, fallback)
      } else {
        setError(fallback)
      }
      return
    }

    setStep('code')
    setMessage(data.message || 'Código enviado para o seu e-mail.')
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, name: tab === 'signup' ? name : undefined }),
    })
    const data = await response.json()

    if (!response.ok) {
      setLoading(false)
      const fallback = data.error || 'Código inválido.'
      if (response.status === 429) {
        handleRateLimit(response, fallback)
      } else {
        setError(fallback)
      }
      return
    }

    if (tab === 'signup' && phone.trim()) {
      try {
        await fetch('/api/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.replace(/\D/g, '') }),
        })
      } catch {
        // Falha no PATCH não bloqueia o login
      }
    }

    setLoading(false)
    router.push(redirectTo)
    router.refresh()
  }

  async function loginWithPassword(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    resetMessages()

    const response = await fetch('/api/auth/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      const fallback = data.error || 'Não foi possível entrar com senha.'
      if (response.status === 429) {
        handleRateLimit(response, fallback)
      } else {
        setError(fallback)
      }
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  function switchTab(next: Tab) {
    setTab(next)
    setStep('email')
    setName('')
    setPhone('')
    setCode('')
    resetMessages()
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '520px' }}>
      <Link href="/" style={{ color: '#1D2235', fontWeight: 600 }}>← Voltar para a loja</Link>
      <section style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderBottom: '1px solid #E3E9F4', marginBottom: '24px' }}>
          <button type="button" onClick={() => switchTab('login')} style={tabStyle(tab === 'login')}>
            Entrar
          </button>
          <button type="button" onClick={() => switchTab('signup')} style={tabStyle(tab === 'signup')}>
            Criar conta
          </button>
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#1D2235', marginBottom: '8px' }}>
          {tab === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
        </h1>
        <p style={{ color: '#5F6678', marginBottom: '24px', fontSize: '14px' }}>
          {tab === 'login'
            ? 'Acesse seus pedidos, endereços e dados pessoais.'
            : 'Cadastre-se para acompanhar seus pedidos com mais facilidade.'}
        </p>

        {tab === 'login' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <button type="button" onClick={() => { setMode('code'); resetMessages() }} style={modeBtnStyle(mode === 'code')}>
              Código por e-mail
            </button>
            <button type="button" onClick={() => { setMode('password'); resetMessages() }} style={modeBtnStyle(mode === 'password')}>
              E-mail e senha
            </button>
          </div>
        )}

        {tab === 'login' && mode === 'password' ? (
          <form onSubmit={loginWithPassword} style={{ display: 'grid', gap: '16px' }}>
            <Input label="E-mail" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            <Input label="Senha" name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={submitDisabled}>
              {loading
                ? 'Entrando...'
                : isCoolingDown
                  ? formatCooldown(cooldownSeconds)
                  : 'Entrar com senha'}
            </Button>
            <a href="/login/esqueci-senha" style={{ color: '#4A7AB5', fontSize: '14px', textAlign: 'center', textDecoration: 'none' }}>
              Esqueceu a senha?
            </a>
          </form>
        ) : step === 'email' ? (
          <form onSubmit={requestCode} style={{ display: 'grid', gap: '16px' }}>
            {tab === 'signup' && (
              <>
                <Input label="Nome completo *" name="name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
                <Input label="Telefone (opcional)" name="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="(11) 99999-9999" />
              </>
            )}
            <Input label="E-mail *" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={submitDisabled}>
              {loading
                ? 'Enviando...'
                : isCoolingDown
                  ? formatCooldown(cooldownSeconds)
                  : tab === 'signup'
                    ? 'Criar conta e receber código'
                    : 'Receber código por e-mail'}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} style={{ display: 'grid', gap: '16px' }}>
            {message && <p role="status" style={{ color: '#1D7A72', margin: 0 }}>{message}</p>}
            <Input
              label="Código de acesso"
              name="code"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={submitDisabled}>
              {loading
                ? 'Validando...'
                : isCoolingDown
                  ? formatCooldown(cooldownSeconds)
                  : 'Entrar'}
            </Button>
            <button type="button" onClick={() => setStep('email')} style={{ border: 'none', background: 'transparent', color: '#1D2235', cursor: 'pointer', fontWeight: 600 }}>
              Usar outro e-mail
            </button>
          </form>
        )}

        <div style={{ borderTop: '1px solid #E3E9F4', marginTop: '24px', paddingTop: '24px' }}>
          <a
            href={`/api/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 16px',
              border: '1px solid #BBCFEB',
              borderRadius: '8px',
              color: '#1D2235',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Entrar com Google
          </a>
        </div>
      </section>
    </main>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '14px 0',
    background: 'none',
    border: 'none',
    borderBottom: active ? '3px solid #1D2235' : '3px solid transparent',
    color: active ? '#1D2235' : '#6B7494',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    marginBottom: '-1px',
  }
}

function modeBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '12px 16px',
    borderRadius: '10px',
    border: active ? '2px solid #1D2235' : '1px solid #BBCFEB',
    backgroundColor: active ? '#F0F5FB' : 'white',
    color: '#1D2235',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px',
  }
}
