'use client'

export type ExpenseFilters = {
  q: string
  status: string
  categoryId: string
  type: string
  costCenter: string
  startDate: string
  endDate: string
  includeArchived: boolean
}

type Props = {
  filters: ExpenseFilters
  categories: { id: string; name: string }[]
  onChange: (filters: ExpenseFilters) => void
}

const input: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  fontFamily: 'inherit',
  background: 'white',
  color: '#1D2235',
}

const COST_CENTERS = [
  { value: '', label: 'Todos os centros' },
  { value: 'producao', label: 'Produção' },
  { value: 'logistica', label: 'Logística' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'outros', label: 'Outros' },
]

export function ExpenseFilters({ filters, categories, onChange }: Props) {
  function update<K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function clearAll() {
    onChange({
      q: '',
      status: '',
      categoryId: '',
      type: '',
      costCenter: '',
      startDate: '',
      endDate: '',
      includeArchived: false,
    })
  }

  const hasFilters =
    filters.q ||
    filters.status ||
    filters.categoryId ||
    filters.type ||
    filters.costCenter ||
    filters.startDate ||
    filters.endDate ||
    filters.includeArchived

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Buscar por titulo ou fornecedor..."
          value={filters.q}
          onChange={(e) => update('q', e.target.value)}
          style={{ ...input, flex: '1', minWidth: '200px' }}
          aria-label="Buscar despesas"
        />

        <select
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
          style={input}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="overdue">Vencida</option>
          <option value="canceled">Cancelado</option>
        </select>

        <select
          value={filters.categoryId}
          onChange={(e) => update('categoryId', e.target.value)}
          style={input}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(e) => update('type', e.target.value)}
          style={input}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          <option value="fixed">Fixa</option>
          <option value="variable">Variavel</option>
          <option value="one_time">Pontual</option>
        </select>

        <select
          value={filters.costCenter}
          onChange={(e) => update('costCenter', e.target.value)}
          style={input}
          aria-label="Filtrar por centro de custo"
        >
          {COST_CENTERS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>Competencia: De</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            style={input}
            aria-label="Data de competencia inicial"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>Ate</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            style={input}
            aria-label="Data de competencia final"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1D2235', cursor: 'pointer', userSelect: 'none', marginTop: '18px' }}>
          <input
            type="checkbox"
            checked={filters.includeArchived}
            onChange={(e) => update('includeArchived', e.target.checked)}
          />
          Incluir arquivadas
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            style={{ marginTop: '18px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6B7494', fontWeight: 500 }}
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
