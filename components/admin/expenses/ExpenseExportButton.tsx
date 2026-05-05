'use client'

import { useState } from 'react'
import type { ExpenseFilters } from './ExpenseFilters'

type Props = {
  filters: ExpenseFilters
  disabled?: boolean
}

export function ExpenseExportButton({ filters, disabled }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.status) params.set('status', filters.status)
      if (filters.categoryId) params.set('categoryId', filters.categoryId)
      if (filters.type) params.set('type', filters.type)
      if (filters.costCenter) params.set('costCenter', filters.costCenter)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.includeArchived) params.set('includeArchived', 'true')

      const res = await fetch(`/api/despesas/export?${params.toString()}`)
      if (!res.ok) {
        alert('Erro ao exportar CSV.')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const stamp = new Date().toISOString().slice(0, 10)
      link.download = `despesas-${stamp}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      alert('Erro de conexao ao exportar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled || loading}
      style={{
        padding: '10px 18px',
        borderRadius: '10px',
        border: 'none',
        background: disabled || loading ? '#9CA3AF' : '#1D7A72',
        color: 'white',
        fontWeight: 600,
        fontSize: '14px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'Exportando...' : 'Exportar CSV'}
    </button>
  )
}
