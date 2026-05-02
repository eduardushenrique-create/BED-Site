import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { deletePrinter, getPrinterById, updatePrinter } from '@/lib/printers'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const printer = await getPrinterById(id)
    if (!printer) return NextResponse.json({ error: 'Impressora não encontrada.' }, { status: 404 })
    return NextResponse.json(printer)
  } catch (error) {
    captureException(error, { context: 'api.impressoras.[id].GET' })
    return NextResponse.json({ error: 'Erro.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const result = await updatePrinter(id, body || {})
    if (!result.ok) return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'printer.update',
      targetType: 'Printer',
      targetId: id,
      summary: `Impressora ${result.printer!.name} atualizada`,
      metadata: { changes: body },
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json(result.printer)
  } catch (error) {
    captureException(error, { context: 'api.impressoras.[id].PATCH' })
    return NextResponse.json({ error: 'Erro ao atualizar.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const result = await deletePrinter(id)
    if (!result.ok) return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'printer.delete',
      targetType: 'Printer',
      targetId: id,
      summary: `Impressora ${id} excluída`,
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    captureException(error, { context: 'api.impressoras.[id].DELETE' })
    return NextResponse.json({ error: 'Erro ao excluir.' }, { status: 500 })
  }
}
