export interface ProductImage {
  id: string
  url: string
  alt: string | null
  isMain: boolean
}

export interface ProductVariant {
  id: string
  name: string
  sku: string | null
  priceDelta: number | null
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
  category: ProductCategory | null
  status?: string
  isActive?: boolean
  isFeatured?: boolean
  stock?: number
  underOrder?: boolean
  weightGrams?: number
  widthCm?: number | null
  heightCm?: number | null
  depthCm?: number | null
  createdAt?: Date | null
  updatedAt?: Date | null
}
