import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { getAlertSettings, updateAlertSettings } from '@/lib/components-stock'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  return NextResponse.json(await getAlertSettings())
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  let body: { lowStockEmails?: unknown; orderAlertEmails?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { settings, error } = await updateAlertSettings(body)
  if (!settings) return NextResponse.json({ error: error || 'Erro.' }, { status: 400 })

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'alert_settings.update',
    targetType: 'AlertSettings',
    targetId: 'default',
    summary: `Configuração de alertas atualizada`,
    metadata: {
      lowStockCount: settings.lowStockEmails.length,
      orderAlertCount: settings.orderAlertEmails.length,
    },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json(settings)
}
