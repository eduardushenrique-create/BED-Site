'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProductionSummaryCards, { ProductionSummary } from '@/components/admin/ProductionSummaryCards'
import ProductionTaskFilters, { ProductionFiltersState } from '@/components/admin/ProductionTaskFilters'
import ProductionTaskTable, { ProductionTaskRow, PrinterOption } from '@/components/admin/ProductionTaskTable'
import DeleteProductionTaskModal from './_components/DeleteProductionTaskModal'

interface ProductionListResponse {
  items: ProductionTaskRow[]
  summary: ProductionSummary
  pagination: { limit: number; offset: number; total: number }
}

interface ProductionSettings {
  id?: string
  dailyCapacityMinutes: number
  riskBufferHours: number
  businessDaysOnly: boolean
}

const PAGE_SIZE = 20

const emptySummary: ProductionSummary = {
  totalOpen: 0,
  pending: 0,
  inProduction: 0,
  paused: 0,
  atRisk: 0,
  overdue: 0,
  completedToday: 0,
}

export default function AdminProducaoPage() {
  const [items, setItems] = useState<ProductionTaskRow[]>([])
  const [summary, setSummary] = useState<ProductionSummary>(emptySummary)
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0 })
  const [filters, setFilters] = useState<ProductionFiltersState>({ status: '', risk: '', priority: '', q: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [printers, setPrinters] = useState<PrinterOption[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<ProductionSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  // SPEC-005 §3.1.3: modal de exclusao de tarefa em 3 modos.
  const [taskToDelete, setTaskToDelete] = useState<ProductionTaskRow | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.risk) params.set('risco', filters.risk)
    if (filters.priority) params.set('prioridade', filters.priority)
    if (filters.q) params.set('q', filters.q)
    params.set('limit', String(pagination.limit))
    params.set('offset', String(pagination.offset))
    return params.toString()
  }, [filters, pagination.limit, pagination.offset])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/producao?${queryString}`, { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      const data = (await res.json()) as ProductionListResponse
      setItems(Array.isArray(data.items) ? data.items : [])
      setSummary(data.summary || emptySummary)
      setPagination((prev) => ({ ...prev, total: data.pagination?.total || 0 }))
    } catch (e) {
      console.error('Erro ao carregar tarefas de produção:', e)
      setError(e instanceof Error ? e.message : 'Erro ao carregar tarefas de produção.')
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    let cancelled = false
    async function loadPrinters() {
      try {
        const res = await fetch('/api/impressoras', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setPrinters(data.map((p: { id: string; name: string; status: 'active' | 'maintenance' | 'offline'; color: string | null }) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            color: p.color,
          })))
        }
      } catch {
        /* silencioso */
      }
    }
    loadPrinters()
    return () => { cancelled = true }
  }, [])

  async function handleAssign(task: ProductionTaskRow, printerId: string | null) {
    setBusyId(task.id)
    try {
      const res = await fetch(`/api/producao/${task.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      await loadTasks()
    } catch (e) {
      console.error('Erro ao atribuir impressora:', e)
      alert(e instanceof Error ? e.message : 'Erro ao atribuir impressora.')
    } finally {
      setBusyId(null)
    }
  }

  // Reset offset whenever filters change
  useEffect(() => {
    setPagination((prev) => (prev.offset === 0 ? prev : { ...prev, offset: 0 }))
  }, [filters])

  async function handleSync() {
    setSyncing(true)
    setSyncFeedback(null)
    try {
      const res = await fetch('/api/producao/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      const created = typeof data?.created === 'number' ? data.created : 0
      setSyncFeedback(
        created > 0
          ? `${created} nova${created === 1 ? '' : 's'} tarefa${created === 1 ? '' : 's'} de produção criada${created === 1 ? '' : 's'}.`
          : 'Nenhuma nova tarefa criada — tudo sincronizado.'
      )
      await loadTasks()
    } catch (e) {
      setSyncFeedback(e instanceof Error ? `Erro: ${e.message}` : 'Erro ao sincronizar.')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncFeedback(null), 6000)
    }
  }

  async function handleIncrement(task: ProductionTaskRow, delta: number) {
    setBusyId(task.id)
    try {
      const res = await fetch(`/api/producao/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityDelta: delta }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      await loadTasks()
    } catch (e) {
      console.error('Erro ao atualizar quantidade:', e)
      alert(e instanceof Error ? e.message : 'Erro ao atualizar quantidade.')
    } finally {
      setBusyId(null)
    }
  }

  async function openSettings() {
    setShowSettings(true)
    setSettingsMessage(null)
    if (settings) return
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/producao/configuracoes', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar configurações.')
      const data = await res.json()
      setSettings({
        id: data.id,
        dailyCapacityMinutes: Number(data.dailyCapacityMinutes) || 480,
        riskBufferHours: Number(data.riskBufferHours) || 24,
        businessDaysOnly: Boolean(data.businessDaysOnly),
      })
    } catch (e) {
      setSettingsMessage(e instanceof Error ? e.message : 'Erro ao carregar configurações.')
    } finally {
      setSettingsLoading(false)
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSettingsSaving(true)
    setSettingsMessage(null)
    try {
      const res = await fetch('/api/producao/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyCapacityMinutes: Number(settings.dailyCapacityMinutes),
          riskBufferHours: Number(settings.riskBufferHours),
          businessDaysOnly: Boolean(settings.businessDaysOnly),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      setSettings({
        id: data.id,
        dailyCapacityMinutes: Number(data.dailyCapacityMinutes),
        riskBufferHours: Number(data.riskBufferHours),
        businessDaysOnly: Boolean(data.businessDaysOnly),
      })
      setSettingsMessage('Configurações salvas com sucesso.')
      await loadTasks()
    } catch (e) {
      setSettingsMessage(e instanceof Error ? e.message : 'Erro ao salvar configurações.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit))
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const hasPrev = pagination.offset > 0
  const hasNext = pagination.offset + pagination.limit < pagination.total

  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235', margin: 0 }}>Produção</h1>
          <p style={{ color: '#6B7494', marginTop: '6px' }}>
            Acompanhe os itens sob encomenda e personalizados
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="/admin/producao/board"
            style={{
              padding: '11px 18px',
              backgroundColor: 'white',
              border: '1px solid #D8DCE8',
              borderRadius: '10px',
              color: '#1D2235',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Visão Kanban
          </a>
          <button
            type="button"
            onClick={openSettings}
            style={{
              padding: '11px 18px',
              backgroundColor: 'white',
              border: '1px solid #D8DCE8',
              borderRadius: '10px',
              color: '#1D2235',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Configurações
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '11px 18px',
              backgroundColor: '#1D2235',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar pedidos em produção'}
          </button>
        </div>
      </header>

      {syncFeedback && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: syncFeedback.startsWith('Erro') ? '#F1E5E9' : '#DFF4EC',
            color: syncFeedback.startsWith('Erro') ? '#A3526A' : '#1D7A72',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {syncFeedback}
        </div>
      )}

      <ProductionSummaryCards summary={summary} />

      <ProductionTaskFilters value={filters} onChange={setFilters} />

      {loading ? (
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '64px',
            textAlign: 'center',
            color: '#6B7494',
            boxShadow: '0 8px 24px rgba(29,34,53,0.06)',
          }}
        >
          Carregando...
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            backgroundColor: '#F1E5E9',
            color: '#A3526A',
            borderRadius: '14px',
            padding: '24px',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '48px',
            textAlign: 'center',
            color: '#3D4460',
            boxShadow: '0 8px 24px rgba(29,34,53,0.06)',
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>Nenhuma tarefa de produção encontrada.</p>
          <p style={{ color: '#6B7494', fontSize: '14px' }}>
            Use o botão &quot;Sincronizar&quot; acima se acabou de configurar produção pela primeira vez.
          </p>
        </div>
      ) : (
        <>
          <ProductionTaskTable
            items={items}
            busyId={busyId}
            onIncrement={handleIncrement}
            printers={printers}
            onAssign={handleAssign}
            onDelete={(task) => setTaskToDelete(task)}
          />

          {taskToDelete && (
            <DeleteProductionTaskModal
              productionTaskId={taskToDelete.id}
              orderNumber={taskToDelete.order.orderNumber || ''}
              itemName={taskToDelete.item.productNameSnapshot || 'Item'}
              onClose={() => setTaskToDelete(null)}
              onSuccess={() => {
                setTaskToDelete(null)
                void loadTasks()
              }}
            />
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: '#6B7494', fontSize: '13px' }}>
              {pagination.total} tarefa{pagination.total === 1 ? '' : 's'} • Página {currentPage} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: Math.max(0, prev.offset - prev.limit),
                  }))
                }
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid #D8DCE8',
                  backgroundColor: 'white',
                  color: '#1D2235',
                  cursor: hasPrev ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: 600,
                  opacity: hasPrev ? 1 : 0.5,
                }}
              >
                ← Anterior
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }))
                }
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid #D8DCE8',
                  backgroundColor: 'white',
                  color: '#1D2235',
                  cursor: hasNext ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: 600,
                  opacity: hasNext ? 1 : 0.5,
                }}
              >
                Próximo →
              </button>
            </div>
          </div>
        </>
      )}

      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configurações de produção"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(29,34,53,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '28px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1D2235', margin: 0 }}>
                Configurações de produção
              </h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Fechar"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '22px',
                  cursor: 'pointer',
                  color: '#6B7494',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </header>

            {settingsLoading ? (
              <p style={{ color: '#6B7494' }}>Carregando...</p>
            ) : settings ? (
              <form onSubmit={handleSaveSettings}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
                    Capacidade diária (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={settings.dailyCapacityMinutes}
                    onChange={(e) =>
                      setSettings({ ...settings, dailyCapacityMinutes: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '4px' }}>
                    Tempo total disponível por dia para produção (ex: 480 = 8h).
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
                    Buffer de risco (horas)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settings.riskBufferHours}
                    onChange={(e) =>
                      setSettings({ ...settings, riskBufferHours: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#6B7494', marginTop: '4px' }}>
                    Janela antes do prazo em que a tarefa entra em risco.
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                    <input
                      type="checkbox"
                      checked={settings.businessDaysOnly}
                      onChange={(e) =>
                        setSettings({ ...settings, businessDaysOnly: e.target.checked })
                      }
                    />
                    <span style={{ fontWeight: 600 }}>Considerar apenas dias úteis</span>
                  </label>
                </div>

                {settingsMessage && (
                  <div
                    role="status"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: settingsMessage.startsWith('Erro') ? '#F1E5E9' : '#DFF4EC',
                      color: settingsMessage.startsWith('Erro') ? '#A3526A' : '#1D7A72',
                      marginBottom: '16px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {settingsMessage}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: 'white',
                      border: '1px solid #D8DCE8',
                      borderRadius: '10px',
                      color: '#3D4460',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#1D2235',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: settingsSaving ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      opacity: settingsSaving ? 0.7 : 1,
                    }}
                  >
                    {settingsSaving ? 'Salvando...' : 'Salvar configurações'}
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ color: '#A3526A' }}>{settingsMessage || 'Falha ao carregar configurações.'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '10px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  color: '#1D2235',
  backgroundColor: 'white',
}
