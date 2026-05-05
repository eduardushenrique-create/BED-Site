'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExpenseForm } from '@/components/admin/expenses/ExpenseForm'

export default function NovaDespesaPage() {
  const router = useRouter()

  function handleSuccess(id: string) {
    router.push(`/admin/despesas/${id}`)
  }

  return (
    <div>
      <header style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Link href="/admin/despesas" style={{ color: '#4A7AB5', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
            Despesas
          </Link>
          <span style={{ color: '#6B7494', fontSize: '13px' }}>/</span>
          <span style={{ color: '#6B7494', fontSize: '13px' }}>Nova</span>
        </div>
        <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', color: '#1D2235', margin: '0 0 4px' }}>Nova Despesa</h1>
        <p style={{ color: '#6B7494', margin: 0 }}>
          Registre uma nova despesa operacional ou lancamento financeiro.
        </p>
      </header>

      <ExpenseForm onSuccess={handleSuccess} />
    </div>
  )
}
