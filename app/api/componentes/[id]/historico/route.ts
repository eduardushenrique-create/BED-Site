import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Export CSV das movimentações de um componente. Útil pra auditoria
 * fiscal e conciliação manual com NF de compras.
 *
 * Sem paginação — exporta o histórico TODO. Pra componentes muito
 * antigos com milhares de movimentos, considerar query string `?since=`
 * num futuro.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id } = await ctx.params

  if (!hasDatabase || !prisma?.component || !prisma?.stockMovement) {
    return new NextResponse('Banco indisponível.', { status: 503 })
  }

  const component = await prisma.component.findUnique({ where: { id } })
  if (!component) return new NextResponse('Componente não encontrado.', { status: 404 })

  const movements = await prisma.stockMovement.findMany({
    where: { componentId: id },
    orderBy: { createdAt: 'desc' },
  })

  const TYPE_LABEL: Record<string, string> = {
    in: 'Entrada',
    out: 'Saida',
    adjust: 'Ajuste',
    reverse: 'Reversao',
  }

  // CSV com BOM UTF-8 + ; pra Excel pt-BR abrir corretamente.
  const lines: string[] = []
  lines.push(['Data', 'Tipo', 'Quantidade', 'Saldo apos', 'Pedido', 'Motivo', 'Lancado por'].join(';'))
  for (const m of movements) {
    const date = m.createdAt.toISOString().replace('T', ' ').slice(0, 19)
    const sign = m.type === 'in' || m.type === 'reverse' ? '' : '-'
    lines.push(
      [
        date,
        TYPE_LABEL[m.type] || m.type,
        `${sign}${Number(m.quantity.toString())}`,
        Number(m.balanceAfter.toString()).toString(),
        m.relatedOrderNumber || '',
        (m.reason || '').replace(/[\r\n;]+/g, ' '),
        m.createdByEmail || '',
      ].join(';'),
    )
  }
  const body = `﻿${lines.join('\r\n')}\r\n`
  const filename = `movimentos-${component.sku || component.id}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
