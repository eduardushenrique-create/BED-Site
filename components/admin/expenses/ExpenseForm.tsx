'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Category = { id: string; name: string }
type SelectOption = { id: string; name: string }

export type ExpenseFormData = {
  title: string
  amount: string
  categoryId: string
  type: 'fixed' | 'variable' | 'one_time'
  status: 'pending' | 'paid' | 'canceled' | 'overdue'
  paymentMethod: string
  costCenter: string
  competenceDate: string
  dueDate: string
  paidAt: string
  supplierName: string
  invoiceNumber: string
  receiptUrl: string
  relatedFilamentId: string
  relatedComponentId: string
  relatedPrinterId: string
  notes: string
}

const EMPTY_FORM: ExpenseFormData = {
  title: '',
  amount: '',
  categoryId: '',
  type: 'variable',
  status: 'pending',
  paymentMethod: '',
  costCenter: '',
  competenceDate: '',
  dueDate: '',
  paidAt: '',
  supplierName: '',
  invoiceNumber: '',
  receiptUrl: '',
  relatedFilamentId: '',
  relatedComponentId: '',
  relatedPrinterId: '',
  notes: '',
}

const COST_CENTERS = [
  { value: '', label: 'Selecione...' },
  { value: 'producao', label: 'Producao' },
  { value: 'logistica', label: 'Logistica' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'outros', label: 'Outros' },
]

const PAYMENT_METHODS = [
  { value: '', label: 'Selecione...' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_credito', label: 'Cartao de Credito' },
  { value: 'cartao_debito', label: 'Cartao de Debito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'outro', label: 'Outro' },
]

type Props = {
  initialData?: Partial<ExpenseFormData>
  expenseId?: string
  onSuccess?: (id: string) => void
}

const input: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #D8DCE8',
  fontSize: '14px',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#1D2235', fontWeight: 600 }}>
      {label}{required && <span style={{ color: '#B42318' }}> *</span>}
      {children}
    </label>
  )
}

export function ExpenseForm({ initialData, expenseId, onSuccess }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<ExpenseFormData>({ ...EMPTY_FORM, ...initialData })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [filaments, setFilaments] = useState<SelectOption[]>([])
  const [components, setComponents] = useState<SelectOption[]>([])
  const [printers, setPrinters] = useState<SelectOption[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadRelated() {
      try {
        const [catRes, filRes, compRes, printRes] = await Promise.allSettled([
          fetch('/api/despesas/categorias', { cache: 'no-store' }),
          fetch('/api/filamentos', { cache: 'no-store' }),
          fetch('/api/componentes', { cache: 'no-store' }),
          fetch('/api/impressoras', { cache: 'no-store' }),
        ])

        if (!cancelled) {
          if (catRes.status === 'fulfilled' && catRes.value.ok) {
            const d = await catRes.value.json()
            setCategories(Array.isArray(d.categories) ? d.categories : Array.isArray(d) ? d : [])
          }
          if (filRes.status === 'fulfilled' && filRes.value.ok) {
            const d = await filRes.value.json()
            const list = Array.isArray(d.filaments) ? d.filaments : Array.isArray(d) ? d : []
            setFilaments(list.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })))
          }
          if (compRes.status === 'fulfilled' && compRes.value.ok) {
            const d = await compRes.value.json()
            const list = Array.isArray(d.components) ? d.components : Array.isArray(d) ? d : []
            setComponents(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
          }
          if (printRes.status === 'fulfilled' && printRes.value.ok) {
            const d = await printRes.value.json()
            const list = Array.isArray(d.printers) ? d.printers : Array.isArray(d) ? d : []
            setPrinters(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
          }
        }
      } catch {
        // silently degrade — related pickers just won't populate
      }
    }

    loadRelated()
    return () => { cancelled = true }
  }, [])

  function set<K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      title: form.title.trim(),
      amount: parseFloat(form.amount),
      categoryId: form.categoryId || null,
      type: form.type,
      status: form.status,
      paymentMethod: form.paymentMethod || null,
      costCenter: form.costCenter || null,
      competenceDate: form.competenceDate || null,
      dueDate: form.dueDate || null,
      paidAt: form.status === 'paid' && form.paidAt ? form.paidAt : null,
      supplierName: form.supplierName.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      receiptUrl: form.receiptUrl.trim() || null,
      relatedFilamentId: form.relatedFilamentId || null,
      relatedComponentId: form.relatedComponentId || null,
      relatedPrinterId: form.relatedPrinterId || null,
      notes: form.notes.trim() || null,
    }

    try {
      const url = expenseId ? `/api/despesas/${expenseId}` : '/api/despesas'
      const method = expenseId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Erro ao salvar despesa.')
        return
      }
      const savedId = data?.expense?.id ?? data?.id ?? expenseId
      if (onSuccess && savedId) {
        onSuccess(savedId)
      } else {
        router.push(savedId ? `/admin/despesas/${savedId}` : '/admin/despesas')
      }
    } catch {
      setError('Erro de conexao.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
      {error && (
        <div style={{ background: '#FEE2E2', color: '#B42318', padding: '12px 16px', borderRadius: '10px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Informacoes basicas */}
      <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Informacoes Basicas
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Titulo" required>
              <input required value={form.title} onChange={(e) => set('title', e.target.value)} style={input} placeholder="Ex.: Compra de filamento PLA" />
            </Field>
          </div>
          <Field label="Valor (R$)" required>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              style={input}
              placeholder="0,00"
            />
          </Field>
          <Field label="Categoria">
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} style={input}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo">
            <select value={form.type} onChange={(e) => set('type', e.target.value as ExpenseFormData['type'])} style={input}>
              <option value="fixed">Fixa</option>
              <option value="variable">Variavel</option>
              <option value="one_time">Pontual</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value as ExpenseFormData['status'])} style={input}>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Vencida</option>
              <option value="canceled">Cancelado</option>
            </select>
          </Field>
          <Field label="Forma de pagamento">
            <select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} style={input}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Centro de custo">
            <select value={form.costCenter} onChange={(e) => set('costCenter', e.target.value)} style={input}>
              {COST_CENTERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Datas */}
      <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Datas
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Field label="Competencia">
            <input type="date" value={form.competenceDate} onChange={(e) => set('competenceDate', e.target.value)} style={input} />
          </Field>
          <Field label="Vencimento">
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} style={input} />
          </Field>
          {form.status === 'paid' && (
            <Field label="Pago em">
              <input type="date" value={form.paidAt} onChange={(e) => set('paidAt', e.target.value)} style={input} />
            </Field>
          )}
        </div>
      </section>

      {/* Fornecedor e nota fiscal */}
      <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Fornecedor & Nota Fiscal
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <Field label="Nome do fornecedor">
            <input value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} style={input} placeholder="Ex.: Empresa XYZ Ltda" />
          </Field>
          <Field label="Numero da nota / NF">
            <input value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} style={input} placeholder="Ex.: NF-12345" />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="URL do comprovante">
              <input type="url" value={form.receiptUrl} onChange={(e) => set('receiptUrl', e.target.value)} style={input} placeholder="https://..." />
            </Field>
          </div>
        </div>
      </section>

      {/* Itens vinculados */}
      <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1D2235', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Vincular a insumo (opcional)
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#6B7494' }}>
          Vincule esta despesa a um filamento, componente ou impressora para rastrear custos de insumos.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <Field label="Filamento">
            <select value={form.relatedFilamentId} onChange={(e) => set('relatedFilamentId', e.target.value)} style={input}>
              <option value="">Nenhum</option>
              {filaments.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Componente">
            <select value={form.relatedComponentId} onChange={(e) => set('relatedComponentId', e.target.value)} style={input}>
              <option value="">Nenhum</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Impressora">
            <select value={form.relatedPrinterId} onChange={(e) => set('relatedPrinterId', e.target.value)} style={input}>
              <option value="">Nenhuma</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Observacoes */}
      <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'grid', gap: '14px' }}>
        <Field label="Observacoes internas">
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            style={input}
            placeholder="Detalhes adicionais sobre esta despesa..."
          />
        </Field>
      </section>

      {/* Acoes */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: saving ? '#9AA1B8' : '#1D2235', color: 'white', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Salvando...' : expenseId ? 'Salvar alteracoes' : 'Criar despesa'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/despesas')}
          style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #D8DCE8', background: 'white', cursor: 'pointer', fontSize: '14px' }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
