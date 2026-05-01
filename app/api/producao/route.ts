import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { listProductionTasks } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { searchParams } = new URL(request.url)

    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10)
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0

    const result = await listProductionTasks({
      status: searchParams.get('status') || undefined,
      risk: searchParams.get('risco') || undefined,
      priority: searchParams.get('prioridade') || undefined,
      q: searchParams.get('q') || undefined,
      limit,
      offset,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/producao] GET failed:', error)
    return NextResponse.json({ error: 'Erro ao listar tarefas de produção.' }, { status: 500 })
  }
}
