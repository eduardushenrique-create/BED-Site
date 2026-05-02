'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/Button'
import Input from '@/components/Input'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Informe seu e-mail.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Não foi possível enviar agora. Tente novamente.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '480px' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Recuperar acesso</p>
        <h1 style={{ fontSize: '28px', color: '#1D2235', margin: '8px 0 8px' }}>Esqueceu sua senha?</h1>
        <p style={{ color: '#6B7494', marginBottom: '24px' }}>
          Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha. O link vale por 1 hora.
        </p>

        {submitted ? (
          <div style={{ background: '#F0F5FB', borderRadius: '10px', padding: '20px', color: '#1D2235' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Pronto!</p>
            <p style={{ margin: 0, color: '#6B7494' }}>
              Se este e-mail tem cadastro de administrador, você recebeu um link para redefinir a senha. Confira sua caixa de entrada (e o spam, por garantia).
            </p>
            <p style={{ marginTop: '16px' }}>
              <Link href="/login" style={{ color: '#4A7AB5', fontWeight: 600 }}>← Voltar ao login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <Input
              label="E-mail"
              name="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
            </Button>
            <Link href="/login" style={{ color: '#4A7AB5', fontSize: '14px', textAlign: 'center', textDecoration: 'none' }}>
              ← Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
