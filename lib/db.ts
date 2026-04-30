import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return null
  }
  
  _supabase = createClient(supabaseUrl, supabaseKey)
  return _supabase
}

export interface Product {
  id: string
  name: string
  slug: string
  sku: string | null
  short_description: string | null
  description: string | null
  price: number
  compare_at_price: number | null
  status: string
  is_active: boolean
  is_featured: boolean
  is_personalizable: boolean
  production_time_min_days: number
  production_time_max_days: number
  weight_grams: number | null
  width_cm: number | null
  height_cm: number | null
  depth_cm: number | null
  category_id: string | null
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  alt: string | null
  sort_order: number
  is_main: boolean
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string | null
  color: string | null
  size: string | null
  material: string | null
  price_delta: number | null
  stock_quantity: number
  is_available: boolean
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface PersonalizationField {
  id: string
  product_id: string
  label: string
  field_type: string
  placeholder: string | null
  help_text: string | null
  is_required: boolean
  min_length: number | null
  max_length: number | null
  sort_order: number
}

export interface ProductWithRelations extends Product {
  category: Category | null
  images: ProductImage[]
  variants: ProductVariant[]
  personalization_fields: PersonalizationField[]
}

export async function getProducts(filters?: {
  category?: string
  featured?: boolean
  personalizable?: boolean
  search?: string
}): Promise<ProductWithRelations[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  let query = supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      images:product_images(*),
      variants:product_variants(*),
      personalization_fields:personalization_fields(*)
    `)
    .eq('is_active', true)

  if (filters?.category) {
    query = query.eq('category.slug', filters.category)
  }
  if (filters?.featured) {
    query = query.eq('is_featured', true)
  }
  if (filters?.personalizable) {
    query = query.eq('is_personalizable', true)
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  return (data || []) as unknown as ProductWithRelations[]
}

export async function getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      images:product_images(*),
      variants:product_variants(*),
      personalization_fields:personalization_fields(*)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching product:', error)
    return null
  }

  return data as unknown as ProductWithRelations
}

export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching categories:', error)
    return []
  }

  return data || []
}

export async function getFeaturedProducts(limit = 4): Promise<ProductWithRelations[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      images:product_images(*),
      variants:product_variants(*)
    `)
    .eq('is_active', true)
    .eq('is_featured', true)
    .limit(limit)

  if (error) {
    console.error('Error fetching featured products:', error)
    return []
  }

  return (data || []) as unknown as ProductWithRelations[]
}

export default getSupabaseClient()