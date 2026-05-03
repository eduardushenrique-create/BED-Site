'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type TemplateRow = {
  slug: string
  label: string
  description: string
  hasOverride: boolean
  isActive: boolean
  updatedAt: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function AdminEmailsPage() {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/email-templates', { cache: 'no-store' })
      if (!res.ok) {
        setError('Não foi possível carregar os templates.')
        return
      }
      const data = await res.json()
      setRows(Array.isArray(data.templates) ? data.templates : [])
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
      <header style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Comunicação</p>
        <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: '#1D2235', margin: '6px 0 4px' }}>Templates de e-mail</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          Edite o texto dos e-mails enviados aos clientes. Templates não customizados continuam usando o padrão do sistema.
        </p>
      </header>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando templates...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#6B7494' }}>Nenhum template encontrado.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {rows.map(row => (
            <Link
              key={row.slug}
              href={`/admin/emails/${row.slug}`}
              style={{
                display: 'block',
                background: 'white',
                borderRadius: '12px',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '17px', color: '#1D2235' }}>{row.label}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6B7494' }}>{row.description}</p>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#A8AFCA', fontFamily: 'var(--font-mono)' }}>{row.slug}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <Badge active={row.hasOverride} disabled={!row.isActive} />
                  {row.updatedAt && (
                    <span style={{ fontSize: '12px', color: '#6B7494' }}>
                      Atualizado em {formatDate(row.updatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Badge({ active, disabled }: { active: boolean; disabled: boolean }) {
  if (disabled) {
    return (
      <span style={{ background: '#FEE2E2', color: '#B42318', borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
        Desativado
      </span>
    )
  }
  if (active) {
    return (
      <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
        Customizado
      </span>
    )
  }
  return (
    <span style={{ background: '#E4EDF8', color: '#4A7AB5', borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
      Padrão do sistema
    </span>
  )
}
