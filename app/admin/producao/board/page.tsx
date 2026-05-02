'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Printer = {
  id: string
  name: string
  status: 'active' | 'maintenance' | 'offline'
  color: string | null
  dailyCapacityMinutes: number
}

type Task = {
  id: string
  status: string
  priority: string
  printerId: string | null
  requiredQuantity: number
  producedQuantity: number
  remainingQuantity: number
  progressPercent: number
  dueAt: string | null
  risk: { level: string; label: string }
  order: { id: string; orderNumber: string; customerName: string | null }
  item: { productNameSnapshot: string | null; skuSnapshot: string | null; quantity: number }
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativa', color: '#10B981' },
  maintenance: { label: 'Em manutenção', color: '#F59E0B' },
  offline: { label: 'Desligada', color: '#6B7494' },
}

export default function ProductionBoardPage() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [printersRes, tasksRes] = await Promise.all([
        fetch('/api/impressoras', { cache: 'no-store' }),
        fetch('/api/producao?limit=200', { cache: 'no-store' }),
      ])
      if (!printersRes.ok) throw new Error('Erro ao carregar impressoras.')
      if (!tasksRes.ok) throw new Error('Erro ao carregar tarefas.')

      const printersData: Printer[] = await printersRes.json()
      const tasksJson = await tasksRes.json()
      setPrinters(printersData)
      setTasks(Array.isArray(tasksJson?.items) ? tasksJson.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAssign(taskId: string, printerId: string | null) {
    setBusyId(taskId)
    try {
      const res = await fetch(`/api/producao/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Erro ao atribuir.')
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const tasksByPrinter = new Map<string | null, Task[]>()
  tasksByPrinter.set(null, [])
  for (const printer of printers) tasksByPrinter.set(printer.id, [])
  for (const t of openTasks) {
    const key = t.printerId && tasksByPrinter.has(t.printerId) ? t.printerId : null
    tasksByPrinter.get(key)!.push(t)
  }

  function totalMinutesForColumn(list: Task[]): number {
    // Aproximação: assume 30 min por unidade restante quando o produto não
    // expõe productionMinutesPerUnit no payload da listagem. É suficiente
    // pra dar feeling de carga.
    return list.reduce((sum, t) => sum + t.remainingQuantity * 30, 0)
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <Link href="/admin/producao" style={{ color: '#6B7494', textDecoration: 'none' }}>← Lista de produção</Link>
        <Link href="/admin/impressoras" style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8', background: 'white', color: '#1D2235', fontWeight: 600, textDecoration: 'none', fontSize: '13px' }}>
          Gerenciar impressoras
        </Link>
      </div>

      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Produção por impressora</h1>
        <p style={{ color: '#6B7494', margin: '4px 0 0' }}>
          Visão Kanban da fila de cada máquina. Use o select inline para atribuir ou realocar tarefas.
        </p>
      </header>

      {error && (
        <p role="alert" style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>{error}</p>
      )}

      {loading ? (
        <p style={{ color: '#6B7494' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
          {Array.from(tasksByPrinter.entries()).map(([printerId, list]) => {
            const printer = printerId ? printers.find(p => p.id === printerId) : null
            const meta = printer ? STATUS_META[printer.status] : null
            const minutes = totalMinutesForColumn(list)
            const capacity = printer?.dailyCapacityMinutes || 0
            const overload = capacity > 0 && minutes > capacity

            return (
              <section
                key={String(printerId) || 'unassigned'}
                style={{
                  flex: '0 0 320px',
                  background: 'white',
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  borderTop: `4px solid ${printer?.color || meta?.color || '#9CA3AF'}`,
                }}
              >
                <header style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#1D2235' }}>
                      {printer ? printer.name : 'Sem máquina'}
                    </h2>
                    <span style={{ fontSize: '12px', color: '#6B7494' }}>{list.length} {list.length === 1 ? 'tarefa' : 'tarefas'}</span>
                  </div>
                  {printer && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px', color: '#6B7494' }}>
                      <span style={{ color: meta?.color, fontWeight: 600 }}>{meta?.label}</span>
                      <span style={{ color: overload ? '#B42318' : '#6B7494', fontWeight: overload ? 700 : 400 }}>
                        ~{minutes}min / {capacity}min/dia
                      </span>
                    </div>
                  )}
                  {!printer && (
                    <p style={{ fontSize: '12px', color: '#6B7494', margin: '4px 0 0' }}>
                      Tarefas ainda não atribuídas. Use o select para mover para uma máquina.
                    </p>
                  )}
                </header>

                <div style={{ display: 'grid', gap: '10px' }}>
                  {list.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#A8AFCA', textAlign: 'center', padding: '20px 0' }}>
                      Vazio
                    </p>
                  ) : (
                    list.map(t => (
                      <article
                        key={t.id}
                        style={{
                          background: '#F9FBFD',
                          borderRadius: '10px',
                          padding: '12px',
                          border: '1px solid #EEF1F8',
                          opacity: busyId === t.id ? 0.5 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{t.order.orderNumber}</strong>
                          <RiskBadge level={t.risk.level} label={t.risk.label} />
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#1D2235', fontWeight: 500 }}>
                          {t.item.productNameSnapshot || 'Item personalizado'}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6B7494' }}>
                          {t.producedQuantity}/{t.requiredQuantity} unid · {t.progressPercent}%
                        </p>
                        {t.dueAt && (
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7494' }}>
                            Prazo: {new Date(t.dueAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        <select
                          value={t.printerId || ''}
                          onChange={e => handleAssign(t.id, e.target.value || null)}
                          disabled={busyId === t.id}
                          style={{ marginTop: '10px', width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D8DCE8', fontSize: '12px' }}
                        >
                          <option value="">— sem máquina —</option>
                          {printers.map(p => (
                            <option key={p.id} value={p.id} disabled={p.status !== 'active'}>
                              {p.name}{p.status !== 'active' ? ` (${p.status === 'maintenance' ? 'manut.' : 'off'})` : ''}
                            </option>
                          ))}
                        </select>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )
          })}

          {printers.length === 0 && (
            <div style={{ flex: 1, padding: '32px', background: 'white', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ color: '#6B7494', marginBottom: '12px' }}>
                Nenhuma impressora cadastrada ainda. Cadastre as máquinas para começar a usar a visão por impressora.
              </p>
              <Link
                href="/admin/impressoras"
                style={{ padding: '10px 18px', borderRadius: '8px', background: '#1D2235', color: 'white', textDecoration: 'none', fontWeight: 600 }}
              >
                Cadastrar impressora
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RiskBadge({ level, label }: { level: string; label: string }) {
  const map: Record<string, string> = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#EF4444',
    critical: '#B42318',
  }
  const color = map[level] || '#6B7494'
  return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, backgroundColor: `${color}20`, color }}>
      {label}
    </span>
  )
}
