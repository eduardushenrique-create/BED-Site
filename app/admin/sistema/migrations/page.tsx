'use client'

import { useState } from 'react'
import Link from 'next/link'

type StepResult = {
  name: string
  status: 'applied' | 'already_applied' | 'skipped' | 'failed'
  detail?: string
}

type ApplyResponse = {
  ok: boolean
  steps: StepResult[]
  message: string
}

type DiagnoseResponse = {
  schemaCheck?: {
    orderType: boolean
    deliveryMethod: boolean
    productionTimeline: boolean
    currentStageNote: boolean
  }
  migrationsApplied?: Array<{
    name: string
    finishedAt: string | null
    rolledBackAt: string | null
  }> | { error: string }
}

const STATUS_COLORS: Record<StepResult['status'], { bg: string; fg: string; label: string }> = {
  applied: { bg: '#DFF4EC', fg: '#0E9F6E', label: 'Aplicada agora' },
  already_applied: { bg: '#F0F5FB', fg: '#6B7494', label: 'Já estava aplicada' },
  skipped: { bg: '#FEF3C7', fg: '#92400E', label: 'Ignorada' },
  failed: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Falhou' },
}

export default function MigrationsAdminPage() {
  const [diagnose, setDiagnose] = useState<DiagnoseResponse | null>(null)
  const [applying, setApplying] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [result, setResult] = useState<ApplyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runDiagnose = async () => {
    setDiagnosing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/diagnose-pipeline', { cache: 'no-store' })
      const data = (await res.json()) as DiagnoseResponse
      setDiagnose(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar diagnóstico.')
    } finally {
      setDiagnosing(false)
    }
  }

  const runApply = async () => {
    if (!confirm('Vai aplicar as migrations pendentes diretamente no banco. Operação irreversível. Continuar?')) {
      return
    }
    setApplying(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/apply-pending-migrations', { method: 'POST' })
      const data = (await res.json()) as ApplyResponse
      setResult(data)
      // Re-rodar diagnóstico para confirmar
      runDiagnose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao aplicar migrations.')
    } finally {
      setApplying(false)
    }
  }

  const allOk = diagnose?.schemaCheck?.orderType && diagnose?.schemaCheck?.deliveryMethod

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin" style={{ color: '#6B7494', textDecoration: 'none', fontSize: 14 }}>← Voltar para o admin</Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>Migrations do banco</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          Verifica o estado do schema do banco e aplica migrations pendentes do redesign do pipeline (deliveryMethod e orderType).
        </p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>1. Diagnóstico</h2>
        <p style={{ fontSize: 13, color: '#6B7494', margin: '0 0 16px' }}>
          Confere se as colunas <code>orderType</code> e <code>deliveryMethod</code> existem na tabela Order. Se aparecer <strong style={{ color: '#B91C1C' }}>FALSE</strong>, a migration ainda não foi aplicada.
        </p>
        <button
          onClick={runDiagnose}
          disabled={diagnosing}
          style={{ padding: '10px 20px', backgroundColor: '#1D2235', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: diagnosing ? 'not-allowed' : 'pointer', opacity: diagnosing ? 0.6 : 1 }}
        >
          {diagnosing ? 'Consultando...' : 'Verificar agora'}
        </button>

        {diagnose?.schemaCheck && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 8, backgroundColor: '#FAFCFE', border: '1px solid #E3E9F4' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E3E9F4' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>Coluna esperada</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>Existe?</th>
                </tr>
              </thead>
              <tbody>
                {(['orderType', 'deliveryMethod', 'productionTimeline', 'currentStageNote'] as const).map((col) => {
                  const exists = diagnose.schemaCheck![col]
                  return (
                    <tr key={col} style={{ borderBottom: '1px solid #F0F5FB' }}>
                      <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>{col}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: exists ? '#DFF4EC' : '#FEE2E2', color: exists ? '#0E9F6E' : '#B91C1C' }}>
                          {exists ? 'SIM' : 'NÃO'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {diagnose?.schemaCheck && !allOk && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 16, borderLeft: '4px solid #F59E0B' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>2. Aplicar migrations pendentes</h2>
          <p style={{ fontSize: 13, color: '#6B7494', margin: '0 0 16px' }}>
            Vai criar as colunas faltantes (<code>orderType</code> e/ou <code>deliveryMethod</code>) e aplicar o backfill dos pedidos existentes. Operação idempotente — se já estiver aplicada, ignora.
          </p>
          <button
            onClick={runApply}
            disabled={applying}
            style={{ padding: '10px 20px', backgroundColor: '#0E9F6E', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: applying ? 'not-allowed' : 'pointer', opacity: applying ? 0.6 : 1 }}
          >
            {applying ? 'Aplicando...' : 'Aplicar migrations agora'}
          </button>
        </div>
      )}

      {diagnose?.schemaCheck && allOk && (
        <div style={{ backgroundColor: '#DFF4EC', borderRadius: 12, padding: 16, marginBottom: 16, color: '#0E9F6E', fontWeight: 600 }}>
          ✓ Schema OK — todas as colunas necessárias existem.
        </div>
      )}

      {result && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Resultado da aplicação</h2>
          <p style={{ fontSize: 13, color: result.ok ? '#0E9F6E' : '#B91C1C', margin: '0 0 16px', fontWeight: 500 }}>
            {result.message}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {result.steps.map((step) => {
              const c = STATUS_COLORS[step.status]
              return (
                <div key={step.name} style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FAFCFE', border: '1px solid #E3E9F4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#1D2235' }}>{step.name}</div>
                    {step.detail && <div style={{ fontSize: 11, color: '#6B7494', marginTop: 2 }}>{step.detail}</div>}
                  </div>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>
                    {c.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <details style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Por que isso é necessário?</summary>
        <p style={{ fontSize: 13, color: '#6B7494', lineHeight: 1.6, margin: '12px 0 0' }}>
          As migrations recentes do redesign do pipeline (deliveryMethod e orderType) precisam ser aplicadas no banco para que pedidos novos sejam classificados corretamente. Em ambientes onde o startup wrapper não rodou (problema de container, deploy parcial), use esta página para forçar a aplicação.
        </p>
        <p style={{ fontSize: 13, color: '#6B7494', lineHeight: 1.6, margin: '8px 0 0' }}>
          Cada migration verifica antes se a coluna já existe — é seguro clicar várias vezes.
        </p>
      </details>
    </div>
  )
}
