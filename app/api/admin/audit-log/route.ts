import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { listAuditLog } from '@/lib/audit-log'
import { captureException } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const result = await listAuditLog({
      actor: searchParams.get('actor') || undefined,
      action: searchParams.get('action') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    captureException(error, { context: 'api.admin.audit-log' })
    return NextResponse.json({ error: 'Erro ao buscar auditoria.' }, { status: 500 })
  }
}
