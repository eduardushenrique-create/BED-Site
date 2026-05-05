import { NextRequest, NextResponse } from 'next/server'
import { createProduct, deleteProduct, listProducts, updateProduct } from '@/lib/database'
import { requireApiAdmin } from '@/lib/api-auth'
import { recordAuditEntry } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  return NextResponse.json(await listProducts())
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const body = await request.json()
  const newProduct = await createProduct(body)
  return NextResponse.json(newProduct, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id, ...data } = await request.json()

  // Capture current visibility before update to detect changes for audit log.
  let before: { visibility: string; name: string } | null = null
  if (id && Object.prototype.hasOwnProperty.call(data, 'visibility')) {
    try {
      before = await (prisma as any).product.findUnique({
        where: { id },
        select: { visibility: true, name: true },
      })
    } catch {
      // best-effort — proceed with update even if pre-read fails
    }
  }

  const product = await updateProduct(id, data)

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Audit: log only when visibility actually changed.
  if (before && before.visibility !== product.visibility) {
    recordAuditEntry({
      actorEmail: auth.user!.email,
      actorRole: auth.user!.role || null,
      action: 'product.visibility.change',
      targetType: 'Product',
      targetId: product.id,
      summary: `Produto ${product.name}: visibilidade ${before.visibility} → ${product.visibility}`,
      metadata: { before: before.visibility, after: product.visibility },
      ip: getClientIp(request),
    }).catch(() => {})
  }

  return NextResponse.json(product)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id || !(await deleteProduct(id))) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
