import { NextResponse } from 'next/server'
import { getLocalCatalogProducts } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const featured = searchParams.get('featured')
  const personalizable = searchParams.get('personalizable')
  const search = searchParams.get('search')

  const products = await getLocalCatalogProducts({
    category: category || undefined,
    featured: featured === 'true',
    personalizable: personalizable === 'true',
    search: search || undefined,
  })

  return NextResponse.json(products)
}
