import { NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico do listOrders. Quando a tela /admin/pedidos volta a zerar
 * mesmo com pedidos no banco, este endpoint mostra exatamente onde a
 * leitura está falhando:
 *
 *   1. rawCount: COUNT(*) direto via raw SQL — ignora qualquer hidratação
 *      do Prisma. Se vier > 0, o banco tem dados.
 *   2. findManyResult: tenta o mesmo findMany que o listOrders faz. Se
 *      falhar, retorna a mensagem de erro do Prisma — geralmente aponta
 *      o campo / relation que está mal-formado.
 *   3. perOrderProbe: para cada pedido (limit 20), tenta hidratar
 *      isoladamente. Os que falham listam o erro específico — esse é o
 *      pedido culpado que estava derrubando o batch inteiro.
 *
 * Uso: GET /api/admin/diagnose-list-orders (logado como admin).
 */
export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!prisma?.order) {
    return NextResponse.json(
      { error: 'Prisma client indisponivel — sistema rodando em fallback localDb.' },
      { status: 503 },
    )
  }

  const result: Record<string, unknown> = {}

  // 1. Conta total direto via raw SQL.
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "Order"`,
    )
    result.rawOrderCount = String(rows[0]?.count ?? 0)
  } catch (err) {
    result.rawOrderCountError = err instanceof Error ? err.message : String(err)
  }

  // 2. Tenta o findMany completo (mesmo include que listOrders usa).
  try {
    const orders = await prisma.order.findMany({
      include: {
        address: true,
        payment: true,
        items: { include: { variant: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    result.findManyOk = true
    result.findManyReturned = orders.length
    result.findManyFirstOrderNumbers = orders.slice(0, 5).map(o => o.orderNumber)
  } catch (err) {
    result.findManyOk = false
    result.findManyError =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    result.findManyStack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : null
  }

  // 3. Probe pedido-por-pedido: tenta hidratar cada um isoladamente,
  //    aponta qual está com problema.
  try {
    const baseList = await prisma.order.findMany({
      select: { id: true, orderNumber: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    const probes: Array<{
      orderNumber: string
      createdAt: string
      ok: boolean
      itemsCount?: number
      hasAddress?: boolean
      hasPayment?: boolean
      error?: string
    }> = []

    for (const o of baseList) {
      try {
        const full = await prisma.order.findUnique({
          where: { id: o.id },
          include: {
            address: true,
            payment: true,
            items: { include: { variant: true } },
          },
        })
        probes.push({
          orderNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          ok: true,
          itemsCount: full?.items?.length ?? 0,
          hasAddress: Boolean(full?.address),
          hasPayment: Boolean(full?.payment),
        })
      } catch (err) {
        probes.push({
          orderNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          ok: false,
          error: err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 300) : String(err).slice(0, 300),
        })
      }
    }

    result.perOrderProbe = probes
    result.perOrderProbeFailures = probes.filter(p => !p.ok).map(p => ({
      orderNumber: p.orderNumber,
      error: p.error,
    }))
  } catch (err) {
    result.perOrderProbeError =
      err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(result, { status: 200 })
}
