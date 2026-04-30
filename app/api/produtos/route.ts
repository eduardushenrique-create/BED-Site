import { NextRequest, NextResponse } from 'next/server'
import { createProduct, deleteProduct, listProducts, updateProduct } from '@/lib/database'

export async function GET() {
  return NextResponse.json(await listProducts())
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newProduct = await createProduct(body)
  return NextResponse.json(newProduct, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { id, ...data } = await request.json()
  const product = await updateProduct(id, data)

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json(product)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id || !(await deleteProduct(id))) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
