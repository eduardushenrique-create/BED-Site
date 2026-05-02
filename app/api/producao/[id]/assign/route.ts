import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { assignTaskToPrinter } from '@/lib/printers'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const printerId = typeof body?.printerId === 'string' && body.printerId.trim() ? body.printerId.trim() : null

    const result = await assignTaskToPrinter(id, printerId)
    if (!result.ok) {
      const status = result.error === 'not_found' || result.error === 'printer_not_found' ? 404 : 400
      return NextResponse.json({ error: result.error || 'Erro.' }, { status })
    }

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: printerId ? 'production.assign' : 'production.unassign',
      targetType: 'ProductionTask',
      targetId: id,
      summary: printerId
        ? `Tarefa ${id} atribuída à impressora ${printerId}`
        : `Tarefa ${id} sem impressora atribuída`,
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.producao.[id].assign' })
    return NextResponse.json({ error: 'Erro ao atribuir.' }, { status: 500 })
  }
}
