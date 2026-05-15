import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { resolveAndCalculate, ValidationError } from '@/lib/orcamentos'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * SPEC-007 §3.1.2 — dry-run da calculadora de orcamento. Nao persiste.
 * Usado pela UI de criacao/edicao para preview em tempo real (debounce 300ms).
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  try {
    const out = await resolveAndCalculate({
      filamentId: body.filamentId ?? null,
      filamentPricePerKgOverride: body.filamentPricePerKgOverride ?? null,
      filamentGrams: Number(body.filamentGrams),
      printHours: Number(body.printHours),
      printerId: body.printerId ?? null,
      components: Array.isArray(body.components) ? body.components : [],
      errorRateOverride: body.errorRateOverride ?? null,
      marginPercentOverride: body.marginPercentOverride ?? null,
    })
    return NextResponse.json({
      ...out.result,
      marginPercentApplied: out.snapshots.marginPercent,
      warnings: out.warnings,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    captureException(error, { context: 'api.orcamentos.calcular' })
    return NextResponse.json({ error: 'Erro ao calcular' }, { status: 500 })
  }
}
