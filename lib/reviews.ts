import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { readDB, writeDB, type ReviewRecord } from '@/lib/localDb'

export type ReviewStatus = 'pending' | 'approved' | 'hidden'

export type PublicReview = {
  id: string
  productId: string
  customerName: string
  rating: number
  title: string | null
  body: string | null
  createdAt: string
}

export type AdminReview = PublicReview & {
  customerEmail: string
  status: ReviewStatus
  orderNumber: string | null
  moderatedAt: string | null
  moderatedBy: string | null
  updatedAt: string
}

export type ReviewAggregate = {
  count: number
  approvedCount: number
  averageRating: number | null
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

const reviewClient = (): any => (prisma as any)?.review

const VALID_STATUSES: ReviewStatus[] = ['pending', 'approved', 'hidden']

function buildAggregate(reviews: { rating: number; status: ReviewStatus }[]): ReviewAggregate {
  const approved = reviews.filter(r => r.status === 'approved')
  const distribution: ReviewAggregate['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  for (const r of approved) {
    const bucket = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
    distribution[bucket] += 1
    total += r.rating
  }
  return {
    count: reviews.length,
    approvedCount: approved.length,
    averageRating: approved.length ? Number((total / approved.length).toFixed(2)) : null,
    distribution,
  }
}

export async function isCustomerEligibleToReview(
  customerEmail: string,
  productId: string,
): Promise<{ eligible: boolean; orderNumber?: string; reason?: 'no_paid_order' | 'already_reviewed' }> {
  const email = customerEmail.trim().toLowerCase()
  if (!email || !productId) return { eligible: false, reason: 'no_paid_order' }

  if (!hasDatabase || !prisma?.order) {
    const db = readDB()
    const paid = db.orders.find(o =>
      o.customerEmail.toLowerCase() === email &&
      o.paymentStatus === 'paid' &&
      (o.items || []).some(i => i.productId === productId),
    )
    if (!paid) return { eligible: false, reason: 'no_paid_order' }
    const existing = (db.reviews || []).find(r => r.productId === productId && r.customerEmail.toLowerCase() === email)
    if (existing) return { eligible: false, reason: 'already_reviewed' }
    return { eligible: true, orderNumber: paid.orderNumber }
  }

  try {
    const paidOrder = await prisma.order.findFirst({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        paymentStatus: 'paid',
        items: { some: { productId } },
      },
      select: { orderNumber: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!paidOrder) return { eligible: false, reason: 'no_paid_order' }

    const existing = await reviewClient()?.findFirst({
      where: { productId, customerEmail: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existing) return { eligible: false, reason: 'already_reviewed' }

    return { eligible: true, orderNumber: paidOrder.orderNumber }
  } catch (error) {
    console.error('[reviews] isCustomerEligibleToReview failed:', error)
    return { eligible: false, reason: 'no_paid_order' }
  }
}

export type CreateReviewInput = {
  productId: string
  customerId?: string | null
  customerName: string
  customerEmail: string
  orderNumber?: string | null
  rating: number
  title?: string | null
  body?: string | null
}

export async function createReview(input: CreateReviewInput): Promise<{ ok: boolean; review?: AdminReview; error?: string }> {
  if (!input.productId) return { ok: false, error: 'invalid_input' }
  const rating = Math.round(Number(input.rating))
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return { ok: false, error: 'invalid_rating' }
  const title = input.title?.trim() ? input.title.trim().slice(0, 120) : null
  const body = input.body?.trim() ? input.body.trim().slice(0, 2000) : null
  const customerName = input.customerName.trim().slice(0, 80)
  const customerEmail = input.customerEmail.trim().toLowerCase()
  if (!customerName || !customerEmail) return { ok: false, error: 'invalid_input' }

  if (!hasDatabase || !reviewClient()) {
    const db = readDB()
    db.reviews = db.reviews || []
    const now = new Date().toISOString()
    const record: ReviewRecord = {
      id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId: input.productId,
      customerId: input.customerId || null,
      customerName,
      customerEmail,
      orderNumber: input.orderNumber || null,
      rating,
      title,
      body,
      status: 'pending',
      moderatedAt: null,
      moderatedBy: null,
      createdAt: now,
      updatedAt: now,
    }
    db.reviews.unshift(record)
    writeDB(db)
    return { ok: true, review: serializeAdminReview(record) }
  }

  try {
    const created = await reviewClient().create({
      data: {
        productId: input.productId,
        customerId: input.customerId || null,
        customerName,
        customerEmail,
        orderNumber: input.orderNumber || null,
        rating,
        title,
        body,
      },
    })
    return { ok: true, review: serializeAdminReview(created) }
  } catch (error) {
    console.error('[reviews] createReview failed:', error)
    return { ok: false, error: 'persist_failed' }
  }
}

export async function listApprovedReviewsForProduct(productId: string, limit = 50): Promise<{ reviews: PublicReview[]; aggregate: ReviewAggregate }> {
  if (!hasDatabase || !reviewClient()) {
    const all = (readDB().reviews || []).filter(r => r.productId === productId)
    const approved = all.filter(r => r.status === 'approved').slice(0, limit)
    return {
      reviews: approved.map(serializePublicReview),
      aggregate: buildAggregate(all.map(r => ({ rating: r.rating, status: r.status }))),
    }
  }

  try {
    const [approved, all] = await Promise.all([
      reviewClient().findMany({
        where: { productId, status: 'approved' },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      reviewClient().findMany({
        where: { productId },
        select: { rating: true, status: true },
      }),
    ])
    return {
      reviews: approved.map(serializePublicReview),
      aggregate: buildAggregate(all),
    }
  } catch (error) {
    console.error('[reviews] listApprovedReviewsForProduct failed:', error)
    return { reviews: [], aggregate: buildAggregate([]) }
  }
}

export async function getRatingsForProductIds(ids: string[]): Promise<Record<string, { averageRating: number | null; approvedCount: number }>> {
  if (ids.length === 0) return {}

  if (!hasDatabase || !reviewClient()) {
    const reviews = readDB().reviews || []
    const out: Record<string, { averageRating: number | null; approvedCount: number }> = {}
    for (const id of ids) {
      const approved = reviews.filter(r => r.productId === id && r.status === 'approved')
      out[id] = approved.length
        ? { averageRating: Number((approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(2)), approvedCount: approved.length }
        : { averageRating: null, approvedCount: 0 }
    }
    return out
  }

  try {
    const groups = await reviewClient().groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, status: 'approved' },
      _avg: { rating: true },
      _count: { _all: true },
    })
    const map: Record<string, { averageRating: number | null; approvedCount: number }> = {}
    for (const id of ids) map[id] = { averageRating: null, approvedCount: 0 }
    for (const row of groups) {
      map[row.productId] = {
        averageRating: row._avg?.rating != null ? Number(Number(row._avg.rating).toFixed(2)) : null,
        approvedCount: row._count?._all ?? 0,
      }
    }
    return map
  } catch (error) {
    console.error('[reviews] getRatingsForProductIds failed:', error)
    return {}
  }
}

export type ListReviewsAdminQuery = {
  status?: ReviewStatus
  productId?: string
  limit?: number
  offset?: number
}

export async function listReviewsAdmin(query: ListReviewsAdminQuery = {}): Promise<{ items: AdminReview[]; total: number }> {
  const limit = Math.min(Math.max(query.limit || 50, 1), 200)
  const offset = Math.max(query.offset || 0, 0)

  if (!hasDatabase || !reviewClient()) {
    let items = (readDB().reviews || []) as ReviewRecord[]
    if (query.status) items = items.filter(r => r.status === query.status)
    if (query.productId) items = items.filter(r => r.productId === query.productId)
    return {
      items: items.slice(offset, offset + limit).map(serializeAdminReview),
      total: items.length,
    }
  }

  try {
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.productId) where.productId = query.productId

    const [records, total] = await Promise.all([
      reviewClient().findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
      reviewClient().count({ where }),
    ])
    return { items: records.map(serializeAdminReview), total }
  } catch (error) {
    console.error('[reviews] listReviewsAdmin failed:', error)
    return { items: [], total: 0 }
  }
}

export async function moderateReview(
  id: string,
  status: ReviewStatus,
  moderatedBy: string,
): Promise<{ ok: boolean; review?: AdminReview }> {
  if (!VALID_STATUSES.includes(status)) return { ok: false }

  if (!hasDatabase || !reviewClient()) {
    const db = readDB()
    const idx = (db.reviews || []).findIndex(r => r.id === id)
    if (idx === -1) return { ok: false }
    const now = new Date().toISOString()
    db.reviews[idx] = { ...db.reviews[idx], status, moderatedAt: now, moderatedBy, updatedAt: now }
    writeDB(db)
    return { ok: true, review: serializeAdminReview(db.reviews[idx]) }
  }

  try {
    const updated = await reviewClient().update({
      where: { id },
      data: { status, moderatedAt: new Date(), moderatedBy },
    })
    return { ok: true, review: serializeAdminReview(updated) }
  } catch (error) {
    console.error('[reviews] moderateReview failed:', error)
    return { ok: false }
  }
}

export async function deleteReview(id: string): Promise<boolean> {
  if (!hasDatabase || !reviewClient()) {
    const db = readDB()
    const before = (db.reviews || []).length
    db.reviews = (db.reviews || []).filter(r => r.id !== id)
    if (db.reviews.length === before) return false
    writeDB(db)
    return true
  }
  try {
    await reviewClient().delete({ where: { id } })
    return true
  } catch (error) {
    console.error('[reviews] deleteReview failed:', error)
    return false
  }
}

function serializePublicReview(r: any): PublicReview {
  return {
    id: r.id,
    productId: r.productId,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }
}

function serializeAdminReview(r: any): AdminReview {
  return {
    id: r.id,
    productId: r.productId,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    orderNumber: r.orderNumber,
    moderatedAt: r.moderatedAt instanceof Date ? r.moderatedAt.toISOString() : r.moderatedAt,
    moderatedBy: r.moderatedBy,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  }
}
