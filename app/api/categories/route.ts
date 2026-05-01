import { NextResponse } from 'next/server'
import { getPublicCatalogCategories } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getPublicCatalogCategories())
}
