import { NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { listComponents } from '@/lib/components-stock'

export const dynamic = 'force-dynamic'

/**
 * Endpoint leve usado pelo sidebar do admin pra mostrar badge vermelho
 * com contagem de componentes em baixa. Cacheia no cliente por 60s
 * (sidebar refaz fetch quando navega).
 */
export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const list = await listComponents({ onlyLow: true, onlyActive: true })
  return NextResponse.json({ count: list.length })
}
