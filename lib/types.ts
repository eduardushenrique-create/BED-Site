export interface ProductImage {
  id: string
  url: string
  alt: string | null
  isMain: boolean
  variantId?: string | null
}

export interface ProductVariant {
  id: string
  name: string
  sku: string | null
  priceDelta: number | null
  priceOverride?: number | null
  color?: string | null
  size?: string | null
  material?: string | null
  finish?: string | null
  stockQuantity?: number
  isAvailable?: boolean
  images?: ProductImage[]
}

export interface PersonalizationField {
  id: string
  label: string
  fieldType: string
  placeholder: string | null
  helpText: string | null
  isRequired: boolean
  minLength: number | null
  maxLength: number | null
}

export interface ProductCategory {
  name: string
  slug: string
}

export type ProductVisibility = 'public' | 'internal'

export interface Product {
  id: string
  name: string
  slug: string
  sku: string | null
  shortDescription: string | null
  description: string | null
  price: number
  compareAtPrice: number | null
  isPersonalizable: boolean
  productionTimeMinDays: number
  productionTimeMaxDays: number
  images: ProductImage[]
  variants: ProductVariant[]
  personalizationFields: PersonalizationField[]
  categories: ProductCategory[]
  status?: string
  isActive?: boolean
  isFeatured?: boolean
  visibility?: ProductVisibility
  stock?: number
  underOrder?: boolean
  weightGrams?: number
  widthCm?: number | null
  heightCm?: number | null
  depthCm?: number | null
  productionMinutesPerUnit?: number | null
  averageRating?: number | null
  reviewCount?: number
  createdAt?: Date | null
  updatedAt?: Date | null
}

// ---------------------------------------------------------------------------
// Production control
// Mirrors the API shapes in section 7 of the production brief. The richer
// admin/customer serializer types live in `lib/production.ts`; this file
// re-exports them so consumers can import everything from `@/lib/types`.
// ---------------------------------------------------------------------------

export type {
  ProductionTaskStatus,
  ProductionPriority,
  ProductionRiskLevel,
  ProductionSettingsLike,
  ProductionProgress,
  ProductionRisk,
  SerializedProductionTaskAdmin,
  SerializedCustomerProduction,
  SerializedCustomerProductionItem,
} from './production'

export interface ProductionTaskFilters {
  status?: string
  risk?: string
  priority?: string
  q?: string
  limit?: number
  offset?: number
}

export interface ProductionTaskSummary {
  totalOpen: number
  pending: number
  inProduction: number
  paused: number
  atRisk: number
  overdue: number
  completedToday: number
}

export interface ProductionPagination {
  limit: number
  offset: number
  total: number
}

export interface ProductionLogEntry {
  id: string
  quantityDelta: number
  quantityAfter: number
  statusBefore: string | null
  statusAfter: string | null
  note: string | null
  createdByEmail: string | null
  createdByName: string | null
  createdAt: string
}

export interface ProductionSettingsDto {
  id: string
  dailyCapacityMinutes: number
  riskBufferHours: number
  businessDaysOnly: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateProductionTaskInput {
  producedQuantity?: number
  quantityDelta?: number
  status?: string
  priority?: string
  dueAt?: string | null
  notes?: string | null
  note?: string
}

export interface UpdateProductionTaskActor {
  email?: string | null
  name?: string | null
}

export interface UpdateProductionSettingsInput {
  dailyCapacityMinutes?: number
  riskBufferHours?: number
  businessDaysOnly?: boolean
}
