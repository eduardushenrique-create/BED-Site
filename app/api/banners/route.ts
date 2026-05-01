import { NextRequest, NextResponse } from 'next/server'
import { createBanner, deleteBanner, listBanners, updateBanner } from '@/lib/database'
import { requireApiAdmin } from '@/lib/api-auth'

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  return NextResponse.json(await listBanners())
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const body = await request.json()
  const newBanner = await createBanner(body)
  return NextResponse.json(newBanner, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { id, ...data } = await request.json()
  const banner = await updateBanner(id, data)

  if (!banner) {
    return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
  }

  return NextResponse.json(banner)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id || !(await deleteBanner(id))) {
    return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
