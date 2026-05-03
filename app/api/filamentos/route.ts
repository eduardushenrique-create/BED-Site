import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { createFilament, listFilaments } from '@/lib/filaments'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  return NextResponse.json({
    filaments: await listFilaments({
      onlyActive: searchParams.get('onlyActive') === '1',
      type: searchParams.get('type') || undefined,
    }),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { filament, error } = await createFilament({
    name: body.name as string,
    brand: body.brand as string | null | undefined,
    type: body.type as string,
    pricePerKg: Number(body.pricePerKg),
    colorHex: body.colorHex as string | null | undefined,
    notes: body.notes as string | null | undefined,
    isActive: body.isActive as boolean | undefined,
  })

  if (!filament) {
    return NextResponse.json({ error: error || 'Erro ao criar filamento.' }, { status: 400 })
  }

  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'filament.create',
    targetType: 'Filament',
    targetId: filament.id,
    summary: `Filamento "${filament.name}" criado`,
    metadata: { name: filament.name, type: filament.type, pricePerKg: filament.pricePerKg },
    ip: getClientIp(request),
  }).catch(() => {})

  return NextResponse.json(filament, { status: 201 })
}
