import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { getProductionTask, updateProductionTask } from '@/lib/database'

export const dynamic = 'force-dynamic'

const VALID_STATUS = ['pending', 'in_production', 'paused', 'completed', 'cancelled'] as const
const VALID_PRIORITY = ['low', 'normal', 'high', 'urgent'] as const

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID da tarefa é obrigatório.' }, { status: 400 })
    }
    const task = await getProductionTask(id)
    if (!task) {
      return NextResponse.json({ error: 'Tarefa de produção não encontrada.' }, { status: 404 })
    }
    return NextResponse.json(task)
  } catch (error) {
    console.error('[api/producao/[id]] GET failed:', error)
    return NextResponse.json({ error: 'Erro ao buscar tarefa de produção.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID da tarefa é obrigatório.' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const input: {
      producedQuantity?: number
      quantityDelta?: number
      status?: 'pending' | 'in_production' | 'paused' | 'completed' | 'cancelled'
      priority?: 'low' | 'normal' | 'high' | 'urgent'
      dueAt?: string | null
      notes?: string | null
      note?: string
    } = {}

    if (body.producedQuantity !== undefined) {
      if (typeof body.producedQuantity !== 'number' || !Number.isFinite(body.producedQuantity)) {
        return NextResponse.json(
          { error: 'producedQuantity deve ser um número finito.' },
          { status: 400 }
        )
      }
      input.producedQuantity = body.producedQuantity
    }

    if (body.quantityDelta !== undefined) {
      if (typeof body.quantityDelta !== 'number' || !Number.isFinite(body.quantityDelta)) {
        return NextResponse.json(
          { error: 'quantityDelta deve ser um número finito.' },
          { status: 400 }
        )
      }
      input.quantityDelta = body.quantityDelta
    }

    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !VALID_STATUS.includes(body.status as any)) {
        return NextResponse.json(
          { error: `Status inválido. Use um de: ${VALID_STATUS.join(', ')}.` },
          { status: 400 }
        )
      }
      input.status = body.status
    }

    if (body.priority !== undefined) {
      if (typeof body.priority !== 'string' || !VALID_PRIORITY.includes(body.priority as any)) {
        return NextResponse.json(
          { error: `Prioridade inválida. Use uma de: ${VALID_PRIORITY.join(', ')}.` },
          { status: 400 }
        )
      }
      input.priority = body.priority
    }

    if (body.dueAt !== undefined) {
      if (body.dueAt === null) {
        input.dueAt = null
      } else if (typeof body.dueAt === 'string') {
        const d = new Date(body.dueAt)
        if (d.toString() === 'Invalid Date') {
          return NextResponse.json(
            { error: 'dueAt deve ser uma data ISO válida ou null.' },
            { status: 400 }
          )
        }
        input.dueAt = body.dueAt
      } else {
        return NextResponse.json(
          { error: 'dueAt deve ser uma string ISO ou null.' },
          { status: 400 }
        )
      }
    }

    if (body.notes !== undefined) {
      if (body.notes === null || typeof body.notes === 'string') {
        input.notes = body.notes
      } else {
        return NextResponse.json(
          { error: 'notes deve ser uma string ou null.' },
          { status: 400 }
        )
      }
    }

    if (body.note !== undefined) {
      if (typeof body.note !== 'string') {
        return NextResponse.json({ error: 'note deve ser uma string.' }, { status: 400 })
      }
      input.note = body.note
    }

    const result = await updateProductionTask(id, input, {
      email: auth.user!.email,
      name: auth.user!.name,
    })

    if (!result.ok) {
      const status = /não encontrada/i.test(result.error) ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json(result.task)
  } catch (error) {
    console.error('[api/producao/[id]] PATCH failed:', error)
    return NextResponse.json({ error: 'Erro ao atualizar tarefa de produção.' }, { status: 500 })
  }
}
