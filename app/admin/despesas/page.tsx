'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ExpenseSummaryCards } from '@/components/admin/expenses/ExpenseSummaryCards'
import { ExpenseFilters, type ExpenseFilters as FiltersType } from '@/components/admin/expenses/ExpenseFilters'
import { ExpenseTable, type ExpenseItem } from '@/components/admin/expenses/ExpenseTable'
import { ExpenseExportButton } from '@/components/admin/expenses/ExpenseExportButton'

type Summary = {
  totalAmount: string
  paidAmount: string
  pendingAmount: string
  overdueAmount: string
}

type ApiResponse = {
  expenses: ExpenseItem[]
  summary: Summary | null
  total: number
  page: number
  totalPages: number
}

const INITIAL_FILTERS: FiltersType = {
  q: '',
  status: '',
  categoryId: '',
  type: '',
  costCenter: '',
  startDate: '',
  endDate: '',
  includeArchived: false,
}

export default function DespesasPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<FiltersType>(INITIAL_FILTERS)
  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/despesas/categorias', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) {
          setCategories(Array.isArray(d.categories) ? d.categories : Array.isArray(d) ? d : [])
        }
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (f: FiltersType, p: number) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (f.q) params.set('q', f.q)
      if (f.status) params.set('status', f.status)
      if (f.categoryId) params.set('categoryId', f.categoryId)
      if (f.type) params.set('type', f.type)
      if (f.costCenter) params.set('costCenter', f.costCenter)
      if (f.startDate) params.set('startDate', f.startDate)
      if (f.endDate) params.set('endDate', f.endDate)
      if (f.includeArchived) params.set('includeArchived', 'true')
      params.set('page', String(p))

      const res = await fetch(`/api/despesas?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Erro ao carregar despesas.')
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError('Erro de conexao.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters, page)
  }, [filters, page, load])

  function handleFiltersChange(newFilters: FiltersType) {
    setFilters(newFilters)
    setPage(1)
  }

  const hasFilters = Object.values(filters).some((v) => v !== '' && v !== false)

  return (
    <div>
      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '12px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
            Financeiro
          </p>
          <h1 style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: '#1D2235', margin: '6px 0 4px' }}>
            Despesas
          </h1>
          <p style={{ color: '#6B7494', margin: 0 }}>
            Lançamentos de despesas operacionais, insumos e custos fixos da empresa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/admin/despesas/categorias" style={{ padding: '10px 18px', borderRadius: '10px', background: 'white', color: '#1D2235', textDecoration: 'none', fontWeight: 600, border: '1px solid #D8DCE8' }}>
            Categorias
          </Link>
          <Link href="/admin/despesas/relatorios" style={{ padding: '10px 18px', borderRadius: '10px', background: 'white', color: '#1D2235', textDecoration: 'none', fontWeight: 600, border: '1px solid #D8DCE8' }}>
            Relatorios
          </Link>
          <ExpenseExportButton filters={filters} disabled={data?.expenses.length === 0} />
          <Link
            href="/admin/despesas/nova"
            style={{ padding: '10px 18px', borderRadius: '10px', background: '#1D2235', color: 'white', textDecoration: 'none', fontWeight: 600 }}
          >
            + Nova Despesa
          </Link>
        </div>
      </header>

      <ExpenseSummaryCards summary={data?.summary ?? null} isLoading={loading && !data} />

      <ExpenseFilters filters={filters} categories={categories} onChange={handleFiltersChange} />

      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" onClick={() => load(filters, page)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #FCA5A5', background: 'white', color: '#B42318', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Tentar novamente
          </button>
        </div>
      )}

      {!error && !loading && data?.expenses.length === 0 && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
          {hasFilters ? (
            <>
              <p style={{ color: '#6B7494', margin: '0 0 12px', fontSize: '16px' }}>Nenhuma despesa encontrada para os filtros aplicados.</p>
              <button type="button" onClick={() => handleFiltersChange(INITIAL_FILTERS)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontWeight: 600 }}>
                Limpar filtros
              </button>
            </>
          ) : (
            <>
              <p style={{ color: '#6B7494', margin: '0 0 12px', fontSize: '16px' }}>Nenhuma despesa cadastrada ainda.</p>
              <Link href="/admin/despesas/nova" style={{ padding: '10px 20px', borderRadius: '8px', background: '#1D2235', color: 'white', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}>
                + Cadastrar primeira despesa
              </Link>
            </>
          )}
        </div>
      )}

      <ExpenseTable expenses={data?.expenses ?? []} isLoading={loading} />

      {/* Paginacao */}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#6B7494' }}>
            Pagina {data.page} de {data.totalPages} · {data.total} despesa{data.total !== 1 ? 's' : ''} no total
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1 || loading}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: data.page <= 1 || loading ? 'not-allowed' : 'pointer', fontSize: '13px', color: '#1D2235' }}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={data.page >= data.totalPages || loading}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: data.page >= data.totalPages || loading ? 'not-allowed' : 'pointer', fontSize: '13px', color: '#1D2235' }}
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
