import { NextRequest, NextResponse } from 'next/server'
import { createCustomer, listCustomers, updateCustomer } from '@/lib/database'
import { requireApiRole } from '@/lib/api-auth'
import { PRIVILEGED_ROLES } from '@/lib/auth-shared'

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(PRIVILEGED_ROLES)
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  return NextResponse.json(await listCustomers(q))
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(PRIVILEGED_ROLES)
  if (auth.response) return auth.response
  const body = await request.json()
  const newUser = await createCustomer(body)

  if (!newUser) {
    return NextResponse.json({ error: 'Email ja cadastrado' }, { status: 400 })
  }

  return NextResponse.json(newUser, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiRole(PRIVILEGED_ROLES)
  if (auth.response) return auth.response
  const { id, ...data } = await request.json()
  const user = await updateCustomer(id, data)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}
