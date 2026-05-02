import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { createPrinter, listPrinters } from '@/lib/printers'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  return NextResponse.json(await listPrinters())
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => null)
    const result = await createPrinter(body || {})
    if (!result.ok) return NextResponse.json({ error: result.error || 'Erro.' }, { status: 400 })

    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'printer.create',
      targetType: 'Printer',
      targetId: result.printer!.id,
      summary: `Impressora ${result.printer!.name} cadastrada`,
      ip: getClientIp(request),
    }).catch(() => {})

    return NextResponse.json(result.printer, { status: 201 })
  } catch (error) {
    captureException(error, { context: 'api.impressoras.POST' })
    return NextResponse.json({ error: 'Erro ao cadastrar.' }, { status: 500 })
  }
}
