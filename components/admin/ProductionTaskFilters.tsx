'use client'

import { useEffect, useState } from 'react'

export interface ProductionFiltersState {
  status: string
  risk: string
  priority: string
  q: string
}

interface ProductionTaskFiltersProps {
  value: ProductionFiltersState
  onChange: (next: ProductionFiltersState) => void
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'in_production', label: 'Em produção' },
  { value: 'paused', label: 'Pausada' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
]

const RISK_OPTIONS = [
  { value: '', label: 'Todos os riscos' },
  { value: 'on_track', label: 'Dentro do prazo' },
  { value: 'attention', label: 'Atenção' },
  { value: 'at_risk', label: 'Em risco' },
  { value: 'overdue', label: 'Atrasado' },
  { value: 'completed', label: 'Concluído' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas as prioridades' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Baixa' },
]

const selectStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: '10px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  color: '#1D2235',
  backgroundColor: 'white',
  minWidth: '170px',
}

export default function ProductionTaskFilters({ value, onChange }: ProductionTaskFiltersProps) {
  const [localQ, setLocalQ] = useState(value.q)

  useEffect(() => {
    setLocalQ(value.q)
  }, [value.q])

  // Debounced search
  useEffect(() => {
    if (localQ === value.q) return
    const timer = setTimeout(() => {
      onChange({ ...value, q: localQ })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ])

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <div style={{ flex: '1 1 260px', minWidth: '240px' }}>
        <input
          type="search"
          aria-label="Buscar por pedido, cliente ou produto"
          placeholder="Buscar por pedido, cliente, produto ou SKU..."
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
          style={{
            width: '100%',
            padding: '11px 14px',
            borderRadius: '10px',
            border: '1px solid #D8DCE8',
            fontSize: '14px',
            color: '#1D2235',
            backgroundColor: 'white',
          }}
        />
      </div>
      <select
        aria-label="Filtrar por status"
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value })}
        style={selectStyle}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por risco"
        value={value.risk}
        onChange={(e) => onChange({ ...value, risk: e.target.value })}
        style={selectStyle}
      >
        {RISK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por prioridade"
        value={value.priority}
        onChange={(e) => onChange({ ...value, priority: e.target.value })}
        style={selectStyle}
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {(value.q || value.status || value.risk || value.priority) && (
        <button
          type="button"
          onClick={() => {
            setLocalQ('')
            onChange({ q: '', status: '', risk: '', priority: '' })
          }}
          style={{
            padding: '11px 14px',
            borderRadius: '10px',
            border: '1px solid #D8DCE8',
            backgroundColor: 'white',
            color: '#3D4460',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
