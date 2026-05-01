import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { updateProductsBulk } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.ids) || !body.updates) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const result = await updateProductsBulk(body.ids as string[], body.updates)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, updated: result.updated })
}
