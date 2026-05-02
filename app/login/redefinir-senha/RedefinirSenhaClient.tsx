'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/Button'
import Input from '@/components/Input'

export default function RedefinirSenhaClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function validate(): string | null {
    if (password.length < 8) return 'A senha precisa ter no mínimo 8 caracteres.'
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letras e números na nova senha.'
    if (password !== confirm) return 'As senhas não conferem.'
    return null
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('Link inválido. Solicite uma nova redefinição.')
      return
    }
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Não foi possível redefinir a senha.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 1800)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '640px' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Nova senha</p>
        <h1 style={{ fontSize: '28px', color: '#1D2235', margin: '8px 0 8px' }}>Redefinir senha</h1>
        <p style={{ color: '#6B7494', marginBottom: '24px' }}>
          Escolha uma nova senha com no mínimo 8 caracteres, contendo letras e números.
        </p>

        {!token && (
          <div style={{ background: '#FEE2E2', borderRadius: '10px', padding: '16px', color: '#B42318', marginBottom: '16px' }}>
            Link inválido ou ausente. <Link href="/login/esqueci-senha" style={{ color: '#B42318', fontWeight: 700 }}>Solicite uma nova redefinição</Link>.
          </div>
        )}

        {success ? (
          <div style={{ background: '#DCFCE7', borderRadius: '10px', padding: '20px', color: '#166534' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Senha redefinida!</p>
            <p style={{ margin: 0 }}>Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <Input
              label="Nova senha"
              name="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={!token}
            />
            <Input
              label="Confirmar nova senha"
              name="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              disabled={!token}
            />
            {error && <p role="alert" style={{ color: '#B42318', margin: 0 }}>{error}</p>}
            <Button type="submit" fullWidth disabled={loading || !token}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
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
