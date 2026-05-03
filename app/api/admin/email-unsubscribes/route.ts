import { NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  if (!hasDatabase || !prisma?.emailUnsubscribe) {
    return NextResponse.json({ unsubscribes: [], counts: { total: 0, byBounce: 0, byLink: 0, byAdmin: 0 } })
  }

  const rows = await prisma.emailUnsubscribe.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const counts = rows.reduce(
    (acc, row) => {
      acc.total += 1
      if (row.source === 'bounce') acc.byBounce += 1
      else if (row.source === 'admin') acc.byAdmin += 1
      else acc.byLink += 1
      return acc
    },
    { total: 0, byBounce: 0, byLink: 0, byAdmin: 0 },
  )

  return NextResponse.json({ unsubscribes: rows, counts })
}
