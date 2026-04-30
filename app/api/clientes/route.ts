import { NextRequest, NextResponse } from 'next/server'
import { createCustomer, listCustomers, updateCustomer } from '@/lib/database'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  return NextResponse.json(await listCustomers(q))
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newUser = await createCustomer(body)

  if (!newUser) {
    return NextResponse.json({ error: 'Email ja cadastrado' }, { status: 400 })
  }

  return NextResponse.json(newUser, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { id, ...data } = await request.json()
  const user = await updateCustomer(id, data)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}
