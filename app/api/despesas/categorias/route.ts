import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { listCategories, createCategory } from '@/lib/expenses'

export const dynamic = 'force-dynamic'

// GET /api/despesas/categorias
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const includeInactive =
    searchParams.get('includeInactive') === '1' ||
    searchParams.get('includeInactive') === 'true'

  const categories = await listCategories(includeInactive)
  return NextResponse.json({ categories })
}

// POST /api/despesas/categorias
// Restricted to roles 'owner' and 'global_admin'
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const role = auth.user!.role
  if (role !== 'owner' && role !== 'global_admin') {
    return NextResponse.json(
      { error: 'Apenas proprietários e administradores globais podem criar categorias.' },
      { status: 403 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Campo "name" é obrigatório.' }, { status: 400 })
  }
  if (typeof body.slug !== 'string' || !body.slug.trim()) {
    return NextResponse.json({ error: 'Campo "slug" é obrigatório.' }, { status: 400 })
  }

  const actor = { email: auth.user!.email ?? '', role }

  const { category, error } = await createCategory(
    {
      name: body.name as string,
      slug: body.slug as string,
      description: (body.description as string | null | undefined) ?? null,
      defaultType: (body.defaultType as string | null | undefined) ?? null,
      costCenter: (body.costCenter as string | null | undefined) ?? null,
      color: (body.color as string | null | undefined) ?? null,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    },
    actor,
  )

  if (error) {
    const status = error.includes('Já existe') ? 409 : 400
    return NextResponse.json({ error }, { status })
  }

  return NextResponse.json({ category }, { status: 201 })
}
