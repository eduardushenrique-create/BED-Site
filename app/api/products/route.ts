import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/db'
import { getLocalCatalogProducts } from '@/lib/catalog'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const featured = searchParams.get('featured')
  const personalizable = searchParams.get('personalizable')
  const search = searchParams.get('search')

  const useDatabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (useDatabase) {
    try {
      const products = await getProducts({
        category: category || undefined,
        featured: featured === 'true',
        personalizable: personalizable === 'true',
        search: search || undefined,
      })

      const serialized = products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        shortDescription: p.short_description,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compare_at_price,
        status: p.status,
        isActive: p.is_active,
        isFeatured: p.is_featured,
        isPersonalizable: p.is_personalizable,
        productionTimeMinDays: p.production_time_min_days,
        productionTimeMaxDays: p.production_time_max_days,
        weightGrams: p.weight_grams,
        widthCm: p.width_cm,
        heightCm: p.height_cm,
        depthCm: p.depth_cm,
        category: p.category,
        images: p.images.map(img => ({
          id: img.id,
          url: img.url,
          alt: img.alt,
          isMain: img.is_main,
        })),
        variants: p.variants.map(v => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          priceDelta: v.price_delta,
        })),
        personalizationFields: p.personalization_fields.map(pf => ({
          id: pf.id,
          label: pf.label,
          fieldType: pf.field_type,
          placeholder: pf.placeholder,
          helpText: pf.help_text,
          isRequired: pf.is_required,
          minLength: pf.min_length,
          maxLength: pf.max_length,
        })),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }))

      return NextResponse.json(serialized)
    } catch (error) {
      console.error('Error fetching from database:', error)
    }
  }

  const products = await getLocalCatalogProducts({
    category: category || undefined,
    featured: featured === 'true',
    personalizable: personalizable === 'true',
    search: search || undefined,
  })

  return NextResponse.json(products)
}
