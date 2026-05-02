import { NextRequest, NextResponse } from 'next/server'

import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { getStorage, isStorageConfigured } from '@/lib/storage'
import { extractContentType, isDataUrl } from '@/lib/storage/data-url'

export const dynamic = 'force-dynamic'

const DEFAULT_BATCH = 20
const MAX_BATCH = 50

type MigrationError = {
  table: 'ProductImage' | 'Banner'
  id: string
  message: string
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          'R2 não está configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL antes de migrar.',
      },
      { status: 503 }
    )
  }

  if (!prisma?.productImage || !prisma?.banner) {
    return NextResponse.json({ error: 'Banco de dados indisponível.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const requestedBatch = Number(body?.batchSize)
  const batchSize = Number.isFinite(requestedBatch) && requestedBatch > 0
    ? Math.min(MAX_BATCH, Math.floor(requestedBatch))
    : DEFAULT_BATCH

  const storage = getStorage()
  const errors: MigrationError[] = []
  let migrated = 0

  // ---------- ProductImage ----------
  const productImages = await prisma.productImage.findMany({
    where: {
      storageKey: null,
      url: { startsWith: 'data:' },
    },
    take: batchSize,
    orderBy: { id: 'asc' },
  })

  for (const image of productImages) {
    if (!isDataUrl(image.url)) continue
    try {
      const contentType = extractContentType(image.url, 'image/jpeg')
      const uploaded = await storage.upload({ data: image.url, contentType, prefix: 'products' })
      await prisma.productImage.update({
        where: { id: image.id },
        data: { url: uploaded.url, storageKey: uploaded.storageKey },
      })
      migrated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[migrate-images] ProductImage falhou', image.id, message)
      errors.push({ table: 'ProductImage', id: image.id, message })
    }
  }

  // ---------- Banner ----------
  const remainingForBanners = Math.max(0, batchSize - productImages.length)
  let banners: Array<{ id: string; imageUrl: string }> = []
  if (remainingForBanners > 0) {
    banners = await prisma.banner.findMany({
      where: {
        storageKey: null,
        imageUrl: { startsWith: 'data:' },
      },
      take: remainingForBanners,
      orderBy: { id: 'asc' },
    })

    for (const banner of banners) {
      if (!isDataUrl(banner.imageUrl)) continue
      try {
        const contentType = extractContentType(banner.imageUrl, 'image/jpeg')
        const uploaded = await storage.upload({ data: banner.imageUrl, contentType, prefix: 'banners' })
        await prisma.banner.update({
          where: { id: banner.id },
          data: { imageUrl: uploaded.url, storageKey: uploaded.storageKey },
        })
        migrated += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[migrate-images] Banner falhou', banner.id, message)
        errors.push({ table: 'Banner', id: banner.id, message })
      }
    }
  }

  const remainingProductImages = await prisma.productImage.count({
    where: { storageKey: null, url: { startsWith: 'data:' } },
  })
  const remainingBanners = await prisma.banner.count({
    where: { storageKey: null, imageUrl: { startsWith: 'data:' } },
  })

  return NextResponse.json({
    migrated,
    remaining: remainingProductImages + remainingBanners,
    breakdown: {
      productImages: remainingProductImages,
      banners: remainingBanners,
    },
    batchSize,
    errors,
  })
}

export async function GET() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!prisma?.productImage || !prisma?.banner) {
    return NextResponse.json({ error: 'Banco de dados indisponível.' }, { status: 503 })
  }

  const [remainingProductImages, remainingBanners] = await Promise.all([
    prisma.productImage.count({ where: { storageKey: null, url: { startsWith: 'data:' } } }),
    prisma.banner.count({ where: { storageKey: null, imageUrl: { startsWith: 'data:' } } }),
  ])

  return NextResponse.json({
    storageConfigured: isStorageConfigured(),
    remaining: remainingProductImages + remainingBanners,
    breakdown: {
      productImages: remainingProductImages,
      banners: remainingBanners,
    },
  })
}
