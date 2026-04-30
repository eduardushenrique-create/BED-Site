import { NextRequest, NextResponse } from 'next/server'
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/lib/database'

export async function GET() {
  return NextResponse.json(await listCategories())
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newCategory = await createCategory(body)
  return NextResponse.json(newCategory, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { id, ...data } = await request.json()
  const category = await updateCategory(id, data)

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  return NextResponse.json(category)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id || !(await deleteCategory(id))) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
