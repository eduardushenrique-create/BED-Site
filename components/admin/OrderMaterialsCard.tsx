'use client'

import { useEffect, useState } from 'react'

type Requirement = {
  componentId: string
  componentName: string
  componentSku: string | null
  componentUnit: string
  required: number
  inStock: number
  shortage: number
}

interface Props {
  orderId: string
}

function formatNumber(n: number, unit: string): string {
  const decimals = ['kg', 'g', 'L', 'ml', 'm'].includes(unit) ? 3 : 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

export default function OrderMaterialsCard({ orderId }: Props) {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [hasShortage, setHasShortage] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/pedidos/${orderId}/materiais`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setRequirements(Array.isArray(data.requirements) ? data.requirements : [])
        setHasShortage(Boolean(data.hasShortage))
      } catch {
        // Silencioso — bloco é informativo, não bloqueia operação
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  if (loading) return null
  if (requirements.length === 0) return null

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Materiais necessários</h2>
        {hasShortage && (
          <span style={{ background: '#FEE2E2', color: '#B42318', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}>
            ⚠️ Faltam componentes
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6B7494' }}>
        Consumo total estimado pra produzir os itens deste pedido.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '8px' }}>
        {requirements.map(r => (
          <li
            key={r.componentId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: r.shortage > 0 ? '#FEE2E2' : '#F9FBFD',
              border: r.shortage > 0 ? '1px solid #FCA5A5' : '1px solid transparent',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#1D2235' }}>{r.componentName}</p>
              {r.componentSku && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7494', fontFamily: 'var(--font-mono)' }}>{r.componentSku}</p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#1D2235', fontFamily: 'var(--font-mono)' }}>
                <strong>{formatNumber(r.required, r.componentUnit)}</strong> {r.componentUnit}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: r.shortage > 0 ? '#B42318' : '#6B7494' }}>
                {r.shortage > 0
                  ? `Faltam ${formatNumber(r.shortage, r.componentUnit)} ${r.componentUnit}`
                  : `Em estoque: ${formatNumber(r.inStock, r.componentUnit)} ${r.componentUnit}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
