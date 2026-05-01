'use client'

import Link from 'next/link'
import ProductionProgressBar from '@/components/ProductionProgressBar'
import ProductionRiskBadge from '@/components/ProductionRiskBadge'
import { ProductionPriorityBadge } from '@/components/ProductionStatusBadge'

export interface ProductionTaskRow {
  id: string
  status: string
  priority: string
  requiredQuantity: number
  producedQuantity: number
  remainingQuantity: number
  progressPercent: number
  dueAt: string | null
  updatedAt: string
  risk: {
    level: string
    label: string
  }
  order: {
    id: string
    orderNumber: string
    customerName: string | null
    customerEmail: string | null
  }
  item: {
    productNameSnapshot: string | null
    skuSnapshot: string | null
    quantity: number
  }
}

interface ProductionTaskTableProps {
  items: ProductionTaskRow[]
  busyId: string | null
  onIncrement: (task: ProductionTaskRow, delta: number) => void
}

function formatDateTime(iso: string | null): string {
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

function formatDate(iso: string | null): string {
  if (!iso) return 'Sem prazo'
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return 'Sem prazo'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return 'Sem prazo'
  }
}

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 700,
  color: '#3D4460',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #D8DCE8',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '13px',
  color: '#1D2235',
  verticalAlign: 'middle',
}

const actionBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600,
  color: '#1D2235',
}

export default function ProductionTaskTable({ items, busyId, onIncrement }: ProductionTaskTableProps) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(29,34,53,0.06)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F0F5FB' }}>
              <th style={thStyle}>Pedido</th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Produto / SKU</th>
              <th style={{ ...thStyle, minWidth: '180px' }}>Progresso</th>
              <th style={thStyle}>Prazo</th>
              <th style={thStyle}>Risco</th>
              <th style={thStyle}>Prioridade</th>
              <th style={thStyle}>Atualizada em</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => {
              const isBusy = busyId === task.id
              const completed = task.status === 'completed' || task.remainingQuantity === 0
              return (
                <tr key={task.id} style={{ borderBottom: '1px solid #EEF1F8' }}>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {task.order.orderNumber || '—'}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#1D2235' }}>
                      {task.order.customerName || '—'}
                    </div>
                    {task.order.customerEmail && (
                      <div style={{ fontSize: '12px', color: '#6B7494' }}>{task.order.customerEmail}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>
                      {task.item.productNameSnapshot || 'Item personalizado'}
                    </div>
                    {task.item.skuSnapshot && (
                      <div style={{ fontSize: '12px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>
                        {task.item.skuSnapshot}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <ProductionProgressBar
                      producedQuantity={task.producedQuantity}
                      requiredQuantity={task.requiredQuantity}
                      showLabel
                      showPercent
                    />
                  </td>
                  <td style={tdStyle}>{formatDate(task.dueAt)}</td>
                  <td style={tdStyle}>
                    <ProductionRiskBadge level={task.risk.level} label={task.risk.label} size="sm" />
                  </td>
                  <td style={tdStyle}>
                    <ProductionPriorityBadge priority={task.priority} size="sm" />
                  </td>
                  <td style={{ ...tdStyle, color: '#6B7494', fontSize: '12px' }}>
                    {formatDateTime(task.updatedAt)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        disabled={isBusy || completed}
                        onClick={() => onIncrement(task, 1)}
                        aria-label={`Incrementar 1 unidade da tarefa do pedido ${task.order.orderNumber}`}
                        style={{
                          ...actionBtn,
                          opacity: isBusy || completed ? 0.5 : 1,
                          cursor: isBusy || completed ? 'not-allowed' : 'pointer',
                        }}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || completed}
                        onClick={() => onIncrement(task, 5)}
                        aria-label={`Incrementar 5 unidades da tarefa do pedido ${task.order.orderNumber}`}
                        style={{
                          ...actionBtn,
                          opacity: isBusy || completed ? 0.5 : 1,
                          cursor: isBusy || completed ? 'not-allowed' : 'pointer',
                        }}
                      >
                        +5
                      </button>
                      <Link
                        href={`/admin/producao/${task.id}`}
                        style={{
                          ...actionBtn,
                          textDecoration: 'none',
                          display: 'inline-block',
                        }}
                      >
                        Detalhe
                      </Link>
                      <Link
                        href={`/admin/pedidos?q=${encodeURIComponent(task.order.orderNumber)}`}
                        style={{
                          ...actionBtn,
                          textDecoration: 'none',
                          display: 'inline-block',
                          backgroundColor: '#F0F5FB',
                        }}
                      >
                        Pedido
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
