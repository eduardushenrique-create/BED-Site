import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { getProductionSettings, updateProductionSettings } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const settings = await getProductionSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('[api/producao/configuracoes] GET failed:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configurações de produção.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const input: {
      dailyCapacityMinutes?: number
      riskBufferHours?: number
      businessDaysOnly?: boolean
    } = {}

    if (body.dailyCapacityMinutes !== undefined) {
      if (
        typeof body.dailyCapacityMinutes !== 'number' ||
        !Number.isFinite(body.dailyCapacityMinutes) ||
        body.dailyCapacityMinutes <= 0
      ) {
        return NextResponse.json(
          { error: 'dailyCapacityMinutes deve ser um número maior que zero.' },
          { status: 400 }
        )
      }
      input.dailyCapacityMinutes = body.dailyCapacityMinutes
    }

    if (body.riskBufferHours !== undefined) {
      if (
        typeof body.riskBufferHours !== 'number' ||
        !Number.isFinite(body.riskBufferHours) ||
        body.riskBufferHours < 0
      ) {
        return NextResponse.json(
          { error: 'riskBufferHours deve ser um número zero ou positivo.' },
          { status: 400 }
        )
      }
      input.riskBufferHours = body.riskBufferHours
    }

    if (body.businessDaysOnly !== undefined) {
      if (typeof body.businessDaysOnly !== 'boolean') {
        return NextResponse.json(
          { error: 'businessDaysOnly deve ser booleano.' },
          { status: 400 }
        )
      }
      input.businessDaysOnly = body.businessDaysOnly
    }

    const result = await updateProductionSettings(input)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result.settings)
  } catch (error) {
    console.error('[api/producao/configuracoes] PATCH failed:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar configurações de produção.' },
      { status: 500 }
    )
  }
}
