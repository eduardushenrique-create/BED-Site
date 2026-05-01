'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import ProductionProgressBar from '@/components/ProductionProgressBar'
import ProductionRiskBadge from '@/components/ProductionRiskBadge'
import ProductionStatusBadge, { ProductionPriorityBadge } from '@/components/ProductionStatusBadge'

interface ProductionLog {
  id: string
  quantityDelta: number
  quantityAfter: number
  statusBefore: string | null
  statusAfter: string | null
  note: string | null
  createdByEmail: string | null
  createdByName: string | null
  createdAt: string
}

interface ProductionTaskDetail {
  id: string
  status: string
  priority: string
  requiredQuantity: number
  producedQuantity: number
  remainingQuantity: number
  progressPercent: number
  dueAt: string | null
  startedAt: string | null
  completedAt: string | null
  notes: string | null
  updatedAt: string
  risk: {
    level: string
    label: string
    reason: string | null
    expectedProgressPercent: number | null
    estimatedRemainingMinutes: number | null
    estimatedCompletionAt: string | null
  }
  order: {
    id: string
    orderNumber: string
    customerName: string | null
    customerEmail: string | null
    fulfillmentStatus: string | null
    productionDeadline: string | null
  }
  item: {
    id: string
    productNameSnapshot: string | null
    skuSnapshot: string | null
    quantity: number
    variantId: string | null
  }
  logs?: ProductionLog[]
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_production', label: 'Em produção' },
  { value: 'paused', label: 'Pausada' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
]

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return '—'
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatMinutes(min: number | null | undefined): string {
  if (typeof min !== 'number' || !Number.isFinite(min) || min < 0) return '—'
  if (min === 0) return '0 min'
  const hours = Math.floor(min / 60)
  const mins = Math.round(min % 60)
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return ''
    const offsetMs = d.getTimezoneOffset() * 60 * 1000
    const local = new Date(d.getTime() - offsetMs)
    return local.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '14px',
  padding: '24px',
  boxShadow: '0 8px 24px rgba(29,34,53,0.06)',
  marginBottom: '20px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#1D2235',
  marginBottom: '16px',
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

const primaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  backgroundColor: '#1D2235',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
}

const ghostBtn: React.CSSProperties = {
  padding: '10px 16px',
  backgroundColor: 'white',
  color: '#1D2235',
  border: '1px solid #D8DCE8',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
}

export default function AdminProductionTaskDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [task, setTask] = useState<ProductionTaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [absoluteQty, setAbsoluteQty] = useState<string>('')
  const [updateNote, setUpdateNote] = useState<string>('')
  const [updateBusy, setUpdateBusy] = useState(false)

  const [priority, setPriority] = useState<string>('normal')
  const [statusValue, setStatusValue] = useState<string>('pending')
  const [dueAtLocal, setDueAtLocal] = useState<string>('')
  const [internalNotes, setInternalNotes] = useState<string>('')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const loadTask = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/producao/${id}`, { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      const data = (await res.json()) as ProductionTaskDetail
      setTask(data)
      setAbsoluteQty(String(data.producedQuantity ?? 0))
      setPriority(data.priority || 'normal')
      setStatusValue(data.status || 'pending')
      setDueAtLocal(toDateTimeLocalValue(data.dueAt))
      setInternalNotes(data.notes || '')
    } catch (e) {
      console.error('Erro ao carregar tarefa:', e)
      setError(e instanceof Error ? e.message : 'Erro ao carregar tarefa.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTask()
  }, [loadTask])

  async function patchTask(payload: Record<string, unknown>): Promise<ProductionTaskDetail | null> {
    if (!id) return null
    const res = await fetch(`/api/producao/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || `Erro ${res.status}`)
    }
    return data as ProductionTaskDetail
  }

  async function handleQuickIncrement(delta: number) {
    if (!task) return
    setUpdateBusy(true)
    setUpdateMessage(null)
    try {
      const payload: Record<string, unknown> = { quantityDelta: delta }
      if (updateNote.trim()) payload.note = updateNote.trim()
      await patchTask(payload)
      setUpdateNote('')
      setUpdateMessage(`+${delta} unidade${delta === 1 ? '' : 's'} registrada${delta === 1 ? '' : 's'}.`)
      await loadTask()
    } catch (e) {
      setUpdateMessage(e instanceof Error ? `Erro: ${e.message}` : 'Erro ao atualizar.')
    } finally {
      setUpdateBusy(false)
    }
  }

  async function handleCompleteAll() {
    if (!task) return
    setUpdateBusy(true)
    setUpdateMessage(null)
    try {
      const payload: Record<string, unknown> = { producedQuantity: task.requiredQuantity }
      if (updateNote.trim()) payload.note = updateNote.trim()
      await patchTask(payload)
      setUpdateNote('')
      setUpdateMessage('Quantidade marcada como concluída.')
      await loadTask()
    } catch (e) {
      setUpdateMessage(e instanceof Error ? `Erro: ${e.message}` : 'Erro ao concluir.')
    } finally {
      setUpdateBusy(false)
    }
  }

  async function handleAbsoluteSave() {
    if (!task) return
    const value = Number(absoluteQty)
    if (!Number.isFinite(value) || value < 0) {
      setUpdateMessage('Erro: digite um número válido.')
      return
    }
    setUpdateBusy(true)
    setUpdateMessage(null)
    try {
      const payload: Record<string, unknown> = { producedQuantity: value }
      if (updateNote.trim()) payload.note = updateNote.trim()
      await patchTask(payload)
      setUpdateNote('')
      setUpdateMessage('Quantidade salva com sucesso.')
      await loadTask()
    } catch (e) {
      setUpdateMessage(e instanceof Error ? `Erro: ${e.message}` : 'Erro ao salvar.')
    } finally {
      setUpdateBusy(false)
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!task) return
    setSettingsBusy(true)
    setSettingsMessage(null)
    try {
      const payload: Record<string, unknown> = {
        priority,
        status: statusValue,
        notes: internalNotes,
      }
      if (dueAtLocal) {
        const d = new Date(dueAtLocal)
        if (Number.isFinite(d.getTime())) payload.dueAt = d.toISOString()
      } else {
        payload.dueAt = null
      }
      await patchTask(payload)
      setSettingsMessage('Configurações salvas.')
      await loadTask()
    } catch (e) {
      setSettingsMessage(e instanceof Error ? `Erro: ${e.message}` : 'Erro ao salvar.')
    } finally {
      setSettingsBusy(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>
    )
  }

  if (error || !task) {
    return (
      <div>
        <button
          type="button"
          onClick={() => router.push('/admin/producao')}
          style={{ ...ghostBtn, marginBottom: '16px' }}
        >
          ← Voltar para a lista
        </button>
        <div
          role="alert"
          style={{
            backgroundColor: '#F1E5E9',
            color: '#A3526A',
            borderRadius: '14px',
            padding: '24px',
            fontWeight: 600,
          }}
        >
          {error || 'Tarefa não encontrada.'}
        </div>
      </div>
    )
  }

  const completed = task.remainingQuantity === 0 || task.status === 'completed'

  return (
    <div>
      <Link
        href="/admin/producao"
        style={{
          display: 'inline-block',
          marginBottom: '16px',
          color: '#3D4460',
          fontWeight: 600,
          fontSize: '14px',
          textDecoration: 'none',
        }}
      >
        ← Voltar para a lista
      </Link>

      <header
        style={{
          backgroundColor: 'white',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 8px 24px rgba(29,34,53,0.06)',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: '#6B7494', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Pedido <span style={{ fontFamily: 'var(--font-mono)' }}>{task.order.orderNumber}</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1D2235', margin: '6px 0 4px' }}>
            {task.item.productNameSnapshot || 'Item personalizado'}
          </h1>
          <div style={{ color: '#6B7494', fontSize: '14px' }}>
            {task.order.customerName || '—'}
            {task.order.customerEmail ? ` • ${task.order.customerEmail}` : ''}
          </div>
          {task.item.skuSnapshot && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>
              SKU: {task.item.skuSnapshot}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ProductionStatusBadge status={task.status} />
          <ProductionRiskBadge level={task.risk.level} label={task.risk.label} />
          <ProductionPriorityBadge priority={task.priority} />
        </div>
      </header>

      <section style={sectionStyle} aria-labelledby="progress-heading">
        <h2 id="progress-heading" style={sectionTitleStyle}>Progresso</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1D2235' }}>
            {task.producedQuantity} / {task.requiredQuantity}
          </div>
          <div style={{ fontSize: '14px', color: '#6B7494', fontWeight: 600 }}>
            {task.progressPercent}% concluído • {task.remainingQuantity} restante{task.remainingQuantity === 1 ? '' : 's'}
          </div>
        </div>
        <ProductionProgressBar
          producedQuantity={task.producedQuantity}
          requiredQuantity={task.requiredQuantity}
          height={14}
        />
      </section>

      <section style={sectionStyle} aria-labelledby="quick-update-heading">
        <h2 id="quick-update-heading" style={sectionTitleStyle}>Atualização rápida</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[1, 5, 10].map((delta) => (
            <button
              key={delta}
              type="button"
              disabled={updateBusy || completed}
              onClick={() => handleQuickIncrement(delta)}
              style={{
                ...primaryBtn,
                opacity: updateBusy || completed ? 0.5 : 1,
                cursor: updateBusy || completed ? 'not-allowed' : 'pointer',
              }}
            >
              +{delta}
            </button>
          ))}
          <button
            type="button"
            disabled={updateBusy || completed}
            onClick={handleCompleteAll}
            style={{
              ...primaryBtn,
              backgroundColor: '#1D7A72',
              opacity: updateBusy || completed ? 0.5 : 1,
              cursor: updateBusy || completed ? 'not-allowed' : 'pointer',
            }}
          >
            Concluir tudo
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="absolute-qty" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
              Quantidade absoluta
            </label>
            <input
              id="absolute-qty"
              type="number"
              min={0}
              value={absoluteQty}
              onChange={(e) => setAbsoluteQty(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <button
              type="button"
              disabled={updateBusy}
              onClick={handleAbsoluteSave}
              style={{
                ...primaryBtn,
                width: '100%',
                opacity: updateBusy ? 0.6 : 1,
                cursor: updateBusy ? 'not-allowed' : 'pointer',
              }}
            >
              Salvar quantidade
            </button>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label htmlFor="update-note" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
            Nota desta atualização (opcional)
          </label>
          <input
            id="update-note"
            type="text"
            value={updateNote}
            onChange={(e) => setUpdateNote(e.target.value)}
            placeholder="Ex: Lote 1 finalizado, faltam ajustes..."
            style={inputStyle}
          />
        </div>

        {updateMessage && (
          <div
            role="status"
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: updateMessage.startsWith('Erro') ? '#F1E5E9' : '#DFF4EC',
              color: updateMessage.startsWith('Erro') ? '#A3526A' : '#1D7A72',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {updateMessage}
          </div>
        )}
      </section>

      <section style={sectionStyle} aria-labelledby="risk-heading">
        <h2 id="risk-heading" style={sectionTitleStyle}>Prazo e estimativa</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <InfoTile label="Prazo" value={formatDateTime(task.dueAt)} />
          <InfoTile
            label="Progresso esperado"
            value={
              typeof task.risk.expectedProgressPercent === 'number'
                ? `${task.risk.expectedProgressPercent}%`
                : '—'
            }
          />
          <InfoTile
            label="Tempo restante estimado"
            value={formatMinutes(task.risk.estimatedRemainingMinutes ?? null)}
          />
          <InfoTile
            label="Conclusão estimada"
            value={formatDateTime(task.risk.estimatedCompletionAt)}
          />
        </div>
        {task.risk.reason && (
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#6B7494' }}>{task.risk.reason}</p>
        )}
      </section>

      <section style={sectionStyle} aria-labelledby="settings-heading">
        <h2 id="settings-heading" style={sectionTitleStyle}>Configurações da tarefa</h2>
        <form onSubmit={handleSaveSettings}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <label htmlFor="priority" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
                Prioridade
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={inputStyle}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
                Status
              </label>
              <select
                id="status"
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                style={inputStyle}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dueAt" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
                Prazo
              </label>
              <input
                id="dueAt"
                type="datetime-local"
                value={dueAtLocal}
                onChange={(e) => setDueAtLocal(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <label htmlFor="notes" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
              Notas internas
            </label>
            <textarea
              id="notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
              placeholder="Anotações visíveis apenas para a equipe..."
            />
          </div>

          {settingsMessage && (
            <div
              role="status"
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: settingsMessage.startsWith('Erro') ? '#F1E5E9' : '#DFF4EC',
                color: settingsMessage.startsWith('Erro') ? '#A3526A' : '#1D7A72',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {settingsMessage}
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={settingsBusy}
              style={{
                ...primaryBtn,
                opacity: settingsBusy ? 0.6 : 1,
                cursor: settingsBusy ? 'not-allowed' : 'pointer',
              }}
            >
              {settingsBusy ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </form>
      </section>

      <section style={sectionStyle} aria-labelledby="logs-heading">
        <h2 id="logs-heading" style={sectionTitleStyle}>Histórico</h2>
        {!task.logs || task.logs.length === 0 ? (
          <p style={{ color: '#6B7494', fontSize: '14px' }}>Nenhuma atualização registrada ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F0F5FB' }}>
                  <th style={logTh}>Quando</th>
                  <th style={logTh}>Operador</th>
                  <th style={{ ...logTh, textAlign: 'right' }}>Δ</th>
                  <th style={{ ...logTh, textAlign: 'right' }}>Total</th>
                  <th style={logTh}>Status</th>
                  <th style={logTh}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {task.logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #EEF1F8' }}>
                    <td style={logTd}>{formatDateTime(log.createdAt)}</td>
                    <td style={logTd}>
                      {log.createdByName || log.createdByEmail || 'Sistema'}
                      {log.createdByName && log.createdByEmail && (
                        <div style={{ fontSize: '11px', color: '#6B7494' }}>{log.createdByEmail}</div>
                      )}
                    </td>
                    <td style={{ ...logTd, textAlign: 'right', fontWeight: 700, color: log.quantityDelta >= 0 ? '#1D7A72' : '#A3526A' }}>
                      {log.quantityDelta > 0 ? `+${log.quantityDelta}` : log.quantityDelta}
                    </td>
                    <td style={{ ...logTd, textAlign: 'right', fontWeight: 600 }}>{log.quantityAfter}</td>
                    <td style={logTd}>
                      {log.statusBefore && log.statusAfter && log.statusBefore !== log.statusAfter
                        ? `${log.statusBefore} → ${log.statusAfter}`
                        : log.statusAfter || '—'}
                    </td>
                    <td style={{ ...logTd, color: '#3D4460' }}>{log.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

const logTh: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 700,
  color: '#3D4460',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const logTd: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#1D2235',
  verticalAlign: 'top',
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        backgroundColor: '#F0F5FB',
        borderRadius: '10px',
      }}
    >
      <div style={{ fontSize: '11px', color: '#6B7494', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '15px', color: '#1D2235', fontWeight: 600, marginTop: '4px' }}>
        {value}
      </div>
    </div>
  )
}
