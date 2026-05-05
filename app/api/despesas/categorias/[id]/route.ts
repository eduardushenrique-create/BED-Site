import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { updateCategory } from '@/lib/expenses'

export const dynamic = 'force-dynamic'

// PUT /api/despesas/categorias/[id]
// Restricted to roles 'owner' and 'global_admin'
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const role = auth.user!.role
  if (role !== 'owner' && role !== 'global_admin') {
    return NextResponse.json(
      { error: 'Apenas proprietários e administradores globais podem editar categorias.' },
      { status: 403 },
    )
  }

  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const actor = { email: auth.user!.email ?? '', role }

  const { category, error } = await updateCategory(
    id,
    {
      ...(body.name !== undefined ? { name: body.name as string } : {}),
      ...(body.slug !== undefined ? { slug: body.slug as string } : {}),
      ...(body.description !== undefined
        ? { description: (body.description as string | null) ?? null }
        : {}),
      ...(body.defaultType !== undefined
        ? { defaultType: (body.defaultType as string | null) ?? null }
        : {}),
      ...(body.costCenter !== undefined
        ? { costCenter: (body.costCenter as string | null) ?? null }
        : {}),
      ...(body.color !== undefined
        ? { color: (body.color as string | null) ?? null }
        : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
    actor,
  )

  if (error) {
    const status = error.includes('não encontrada')
      ? 404
      : error.includes('Já existe')
        ? 409
        : 400
    return NextResponse.json({ error }, { status })
  }

  return NextResponse.json({ category })
}
