'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function PrivacidadePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) router.replace('/login?redirect=/minha-conta/privacidade')
  }, [user, authLoading, router])

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const res = await fetch('/api/me/export', { cache: 'no-store' })
      if (!res.ok) {
        setError('Não foi possível exportar agora. Tente novamente.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bed-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/me', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Não foi possível excluir a conta.')
        return
      }
      window.location.href = '/'
    } catch {
      setError('Erro de conexão.')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || !user) {
    return <main className="container" style={{ paddingTop: '112px', textAlign: 'center', color: '#6B7494' }}>Carregando...</main>
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '720px' }}>
      <Link href="/minha-conta" style={{ color: '#6B7494', textDecoration: 'none' }}>← Minha conta</Link>

      <div style={{ marginTop: '16px', marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Privacidade</p>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: '#1D2235', margin: '8px 0 4px' }}>Seus dados, seus direitos</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>Você pode baixar uma cópia dos seus dados ou solicitar a exclusão da conta a qualquer momento.</p>
      </div>

      {error && (
        <div role="alert" style={{ background: '#FEE2E2', borderRadius: '10px', padding: '12px 16px', color: '#B42318', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <section style={{ background: 'white', padding: '24px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Exportar meus dados</h2>
        <p style={{ color: '#6B7494', margin: '0 0 16px' }}>
          Faça download de um arquivo JSON com seus dados cadastrais, endereços salvos, histórico de pedidos e produtos favoritos.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          style={{ padding: '12px 22px', background: '#1D2235', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1 }}
        >
          {exporting ? 'Preparando arquivo...' : 'Baixar meus dados (JSON)'}
        </button>
      </section>

      <section style={{ background: 'white', padding: '24px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '4px solid #EF4444' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px', color: '#B42318' }}>Excluir minha conta</h2>
        <p style={{ color: '#6B7494', margin: '0 0 16px' }}>
          Seus dados pessoais (nome, e-mail, telefone, CPF, endereços salvos e favoritos) serão removidos. Pedidos antigos serão preservados de forma anonimizada para fins fiscais e de compliance.
        </p>

        {!showDelete ? (
          <button
            type="button"
            onClick={() => { setShowDelete(true); setDeleteConfirm(''); setError('') }}
            style={{ padding: '12px 22px', background: 'white', border: '1px solid #EF4444', borderRadius: '10px', color: '#B42318', fontWeight: 600, cursor: 'pointer' }}
          >
            Iniciar exclusão da conta
          </button>
        ) : (
          <div style={{ background: '#FEE2E2', padding: '16px', borderRadius: '10px' }}>
            <p style={{ margin: '0 0 12px', color: '#1D2235', fontWeight: 600 }}>
              Esta ação é irreversível. Para confirmar, digite EXCLUIR no campo abaixo.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="EXCLUIR"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8DCE8', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setShowDelete(false); setDeleteConfirm('') }}
                style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #D8DCE8', borderRadius: '10px', cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#EF4444',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: deleting || deleteConfirm.trim().toUpperCase() !== 'EXCLUIR' ? 'not-allowed' : 'pointer',
                  opacity: deleting || deleteConfirm.trim().toUpperCase() !== 'EXCLUIR' ? 0.6 : 1,
                }}
              >
                {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
