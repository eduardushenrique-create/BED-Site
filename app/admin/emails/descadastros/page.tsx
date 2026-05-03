'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Unsubscribe = {
  id: string
  email: string
  reason: string | null
  source: string
  createdAt: string
}

type Counts = { total: number; byBounce: number; byLink: number; byAdmin: number }

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  link: { label: 'Link no e-mail', color: '#4A7AB5' },
  bounce: { label: 'Bounce / spam', color: '#B42318' },
  admin: { label: 'Manual (admin)', color: '#6B7494' },
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function DescadastrosPage() {
  const [rows, setRows] = useState<Unsubscribe[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, byBounce: 0, byLink: 0, byAdmin: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/email-unsubscribes', { cache: 'no-store' })
        if (!res.ok) {
          setError('Não foi possível carregar.')
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setRows(Array.isArray(data.unsubscribes) ? data.unsubscribes : [])
          setCounts(data.counts || { total: 0, byBounce: 0, byLink: 0, byAdmin: 0 })
        }
      } catch {
        if (!cancelled) setError('Erro de conexão.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <Link href="/admin/emails" style={{ color: '#6B7494', textDecoration: 'none', fontSize: '14px' }}>← Templates de e-mail</Link>
      </div>

      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Comunicação</p>
        <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: '#1D2235', margin: '6px 0 4px' }}>Descadastros</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          Quem está fora das próximas campanhas. Inclui opt-outs por link, bounces permanentes e marcações manuais.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <KpiCard label="Total" value={counts.total} />
        <KpiCard label="Pelo link" value={counts.byLink} />
        <KpiCard label="Bounce / spam" value={counts.byBounce} />
        <KpiCard label="Manual" value={counts.byAdmin} />
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando...</p>
      ) : rows.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#6B7494', margin: 0 }}>Nenhum descadastro registrado ainda.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FBFD' }}>
                <th style={th}>E-mail</th>
                <th style={th}>Origem</th>
                <th style={th}>Motivo</th>
                <th style={th}>Quando</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const meta = SOURCE_LABELS[row.source] || SOURCE_LABELS.link
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid #E3E9F4' }}>
                    <td style={td}>{row.email}</td>
                    <td style={td}>
                      <span style={{ color: meta.color, fontWeight: 600, fontSize: '13px' }}>{meta.label}</span>
                    </td>
                    <td style={{ ...td, color: '#6B7494', fontSize: '13px' }}>{row.reason || '—'}</td>
                    <td style={{ ...td, color: '#6B7494', fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDate(row.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: 0, fontSize: '12px', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: '#1D2235' }}>{value}</p>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7494', textTransform: 'uppercase', letterSpacing: '0.06em' }
const td: React.CSSProperties = { padding: '12px 16px', fontSize: '14px', color: '#1D2235' }
