/**
 * SPEC-007 §3.1.3 — página de visualização/edição de orçamento.
 * Server component: busca os dados via API e passa ao EstimateForm.
 * Em Next.js 16, params é uma Promise.
 */

import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { serializeEstimate } from '@/lib/orcamentos'
import EstimateForm from '../_components/EstimateForm'

type EstimateComponent = {
  componentId: string | null
  name: string
  unit: string
  qty: number
  unitCostSnapshot: number
}

type EstimateData = {
  id: string
  name: string
  status: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  notes: string | null
  quantity: number
  filamentId: string | null
  filamentGrams: number
  printHours: number
  printerId: string | null
  components: EstimateComponent[]
  errorRate: number
  marginPercent: number
  costTotal: number
  suggestedPrice: number
  finalPrice: number | null
  convertedToOrderId: string | null
}

async function getEstimate(id: string): Promise<EstimateData | null> {
  // Carrega direto do DB para evitar dependência de NEXT_PUBLIC_APP_URL no
  // server component (em Railway staging a env não existe e o fetch caía em
  // localhost:3000 → ECONNREFUSED → catch → notFound() → 404).
  if (!hasDatabase || !(prisma as any)?.pricingEstimate) return null
  try {
    const row = await (prisma as any).pricingEstimate.findUnique({ where: { id } })
    if (!row) return null
    const data = serializeEstimate(row)
    return {
      ...data,
      components: data.components ?? [],
    } as EstimateData
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Orçamento ${id.slice(0, 8)}… — Admin BED` }
}

export default async function OrcamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const estimate = await getEstimate(id)

  if (!estimate) {
    notFound()
  }

  return <EstimateForm estimate={estimate} />
}
