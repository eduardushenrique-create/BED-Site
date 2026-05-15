'use client'

/**
 * SPEC-007 §3.1.3 — listagem de orçamentos.
 *
 * Filtra por status e busca por nome/cliente. Colunas: Nome / Cliente /
 * Custo total / Preço final / Status / Data.
 * Segue padrão de tabela admin (coding-standards.md §"Tabela admin").
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Estimate = {
  id: string
  name: string
  customerName: string | null
  costTotal: number
  finalPrice: number | null
  suggestedPrice: number
  status: string
  createdAt: string
  convertedToOrderId: string | null
}

type ListResponse = {
  items: Estimate[]
  total: number
  page: number
  pageSize: number
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  converted: 'Convertido',
}

const STATUS_CHIP: Record<string, React.CSSProperties> = {
  draft: { background: '#EEF1F8', color: '#6B7494' },
  sent: { background: '#E8EEF8', color: '#1D2235' },
  approved: { background: '#DFF4EC', color: '#0E9F6E' },
  rejected: { background: '#FEE2E2', color: '#B42318' },
  converted: { background: '#DFF4EC', color: '#0E9F6E' },
}

function StatusChip({ status }: { status: string }) {
  const style = STATUS_CHIP[status] ?? STATUS_CHIP.draft
  return (
    <span
      style={{
        ...style,
        borderRadius: '999px',
        padding: '3px 10px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function OrcamentosPage() {
  const [items, setItems] = useState<Estimate[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))

    fetch(`/api/orcamentos?${params}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<ListResponse> : Promise.reject(r.statusText))
      .then(data => {
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
      })
      .catch(err => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [search, statusFilter, page])

  // Debounce search
  const searchTimerRef = { current: null as ReturnType<typeof setTimeout> | null }
  function handleSearchChange(value: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '12px',
              color: '#4A7AB5',
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Admin
          </p>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', color: '#1D2235', margin: '6px 0 4px' }}>
            Orçamentos
          </h1>
          <p style={{ color: '#6B7494', margin: 0, fontSize: '14px' }}>
            {total > 0 ? `${total} orçamento${total !== 1 ? 's' : ''}` : 'Nenhum orçamento ainda'}
          </p>
        </div>
        <Link
          href="/admin/orcamentos/novo"
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: '#1D2235',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          + Novo orçamento
        </Link>
      </header>

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          placeholder="Buscar por nome ou cliente…"
          defaultValue=""
          onChange={e => handleSearchChange(e.target.value)}
          style={{
            flex: '1 1 220px',
            padding: '9px 12px',
            borderRadius: '8px',
            border: '1px solid #D8DCE8',
            fontSize: '14px',
            backgroundColor: 'white',
            color: '#1D2235',
          }}
          aria-label="Buscar orçamentos"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: '1px solid #D8DCE8',
            fontSize: '14px',
            backgroundColor: 'white',
            color: '#1D2235',
            minWidth: '160px',
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="sent">Enviado</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Rejeitado</option>
          <option value="converted">Convertido</option>
        </select>
      </div>

      {/* Estados: loading / erro / vazio */}
      {loading && (
        <p style={{ color: '#6B7494', fontSize: '14px' }}>Carregando…</p>
      )}

      {!loading && error && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEE2E2',
            color: '#B42318',
            padding: '14px 16px',
            borderRadius: '10px',
            fontSize: '14px',
          }}
        >
          Erro ao carregar orçamentos. Tente recarregar a página.
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '48px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#9AA2B8', fontSize: '15px', margin: '0 0 16px' }}>
            {search || statusFilter ? 'Nenhum orçamento encontrado para esses filtros.' : 'Nenhum orçamento criado ainda.'}
          </p>
          {!search && !statusFilter && (
            <Link
              href="/admin/orcamentos/novo"
              style={{
                display: 'inline-block',
                padding: '10px 18px',
                borderRadius: '10px',
                backgroundColor: '#1D2235',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Criar primeiro orçamento
            </Link>
          )}
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Tabela */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#6B7494',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Nome
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#6B7494',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Cliente
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#6B7494',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Custo
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#6B7494',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Preço
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#6B7494',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#6B7494',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((est, idx) => {
                  const displayPrice = est.finalPrice ?? est.suggestedPrice
                  return (
                    <tr
                      key={est.id}
                      style={{
                        borderBottom: idx < items.length - 1 ? '1px solid #EEF1F8' : 'none',
                        backgroundColor: 'white',
                      }}
                    >
                      <td
                        style={{
                          padding: '12px 16px',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={est.name}
                      >
                        <Link
                          href={`/admin/orcamentos/${est.id}`}
                          style={{ color: '#1D2235', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}
                        >
                          {est.name}
                        </Link>
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontSize: '14px',
                          color: '#6B7494',
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={est.customerName ?? ''}
                      >
                        {est.customerName ?? <span style={{ color: '#9AA2B8' }}>—</span>}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontFamily: 'var(--font-mono)',
                          color: '#1D2235',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtBRL(est.costTotal)}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontFamily: 'var(--font-mono)',
                          color: '#0E9F6E',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtBRL(displayPrice)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {est.status === 'converted' && est.convertedToOrderId ? (
                          <Link
                            href={`/admin/pedidos/${est.convertedToOrderId}`}
                            style={{ textDecoration: 'none' }}
                            title="Ver pedido"
                          >
                            <StatusChip status="converted" />
                            <span style={{ marginLeft: '4px', fontSize: '12px', color: '#0E9F6E' }}>↗</span>
                          </Link>
                        ) : (
                          <StatusChip status={est.status} />
                        )}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontSize: '13px',
                          color: '#9AA2B8',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtDate(est.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '16px',
              }}
            >
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D8DCE8',
                  backgroundColor: 'white',
                  color: page === 1 ? '#9AA2B8' : '#1D2235',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                ← Anterior
              </button>
              <span style={{ padding: '8px 12px', fontSize: '14px', color: '#6B7494' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D8DCE8',
                  backgroundColor: 'white',
                  color: page === totalPages ? '#9AA2B8' : '#1D2235',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
