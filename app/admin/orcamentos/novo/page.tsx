/**
 * SPEC-007 §3.1.3 — página de criação de novo orçamento.
 * Server component (sem estado) — apenas renderiza o EstimateForm.
 */

import EstimateForm from '../_components/EstimateForm'

export const metadata = {
  title: 'Novo orçamento — Admin BED',
}

export default function NovoOrcamentoPage() {
  return <EstimateForm />
}
