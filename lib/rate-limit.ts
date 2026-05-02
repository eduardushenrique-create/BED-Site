import 'server-only'

import type { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { isUpstashConfigured, pipeline } from '@/lib/upstash'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'rate-limit' })

export type RateLimitResult = {
  ok: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds?: number
}

type MemoryBucket = {
  count: number
  resetAt: number
}

const memoryBuckets = new Map<string, MemoryBucket>()

const MEMORY_CLEANUP_THRESHOLD = 500

function cleanupMemoryBuckets(now: number) {
  if (memoryBuckets.size < MEMORY_CLEANUP_THRESHOLD) return
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAt <= now) {
      memoryBuckets.delete(key)
    }
  }
}

function consumeInMemory(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now()
  cleanupMemoryBuckets(now)
  const existing = memoryBuckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000
    memoryBuckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt: new Date(resetAt) }
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: new Date(existing.resetAt),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  memoryBuckets.set(key, existing)
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: new Date(existing.resetAt),
  }
}

async function consumeInDatabase(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  // We accept a small race here. Two near-simultaneous requests may both succeed
  // even when at the threshold; rate-limit is a coarse defence, not a financial counter.
  const now = new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = prisma as any
  const existing = await client.rateLimitBucket.findUnique({ where: { key } })

  if (!existing || existing.resetAt.getTime() <= now.getTime()) {
    const resetAt = new Date(now.getTime() + windowSeconds * 1000)
    try {
      await client.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      })
    } catch {
      // Race or transient error: degrade open but log result for observability.
    }
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt }
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000),
    )
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    }
  }

  try {
    await client.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    })
  } catch {
    // best-effort
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - (existing.count + 1)),
    resetAt: existing.resetAt,
  }
}

async function consumeInUpstash(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  // Atomic INCR + (set TTL on first hit) via single pipeline call.
  const namespacedKey = `bed:rl:${key}`
  const results = await pipeline([
    ['INCR', namespacedKey],
    ['EXPIRE', namespacedKey, windowSeconds, 'NX'],
    ['PTTL', namespacedKey],
  ])

  const count = Number(results[0])
  // results[1] = EXPIRE result (1 set, 0 not set)
  const pttl = Number(results[2])
  const ttlMs = Number.isFinite(pttl) && pttl > 0 ? pttl : windowSeconds * 1000
  const resetAt = new Date(Date.now() + ttlMs)

  if (!Number.isFinite(count) || count <= 0) {
    // Defensive: treat as ok-but-zero (don't block legit traffic on weird response).
    return { ok: true, remaining: limit, resetAt }
  }

  if (count > limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    }
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - count),
    resetAt,
  }
}

/**
 * Try to consume one token from the bucket identified by `key`.
 *
 * Storage (in priority order):
 * - Upstash Redis REST when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are configured.
 * - Postgres (`RateLimitBucket`) when `hasDatabase` is true and the prisma client is available.
 * - In-process `Map` fallback otherwise (dev / no-DB mode).
 *
 * Window semantics: simple sliding bucket. The first hit creates the bucket with
 * `resetAt = now + windowSeconds`. Subsequent hits within that window increment the
 * count. After `resetAt` the bucket is reset on the next hit.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (limit <= 0 || windowSeconds <= 0) {
    const resetAt = new Date(Date.now() + Math.max(1, windowSeconds) * 1000)
    return { ok: true, remaining: limit, resetAt }
  }

  if (isUpstashConfigured()) {
    try {
      return await consumeInUpstash(key, limit, windowSeconds)
    } catch (error) {
      log.warn({ err: error instanceof Error ? error.message : String(error) }, 'Upstash failed, falling back to DB/memory')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasBucketModel = Boolean(hasDatabase && (prisma as any)?.rateLimitBucket)

  if (hasBucketModel) {
    try {
      return await consumeInDatabase(key, limit, windowSeconds)
    } catch (error) {
      log.warn({ err: error instanceof Error ? error.message : String(error) }, 'DB bucket failed, falling back to memory')
      return consumeInMemory(key, limit, windowSeconds)
    }
  }

  return consumeInMemory(key, limit, windowSeconds)
}

export function buildRateLimitKey(scope: string, ...identifiers: string[]): string {
  return `${scope}:${identifiers.filter(Boolean).join(':')}`
}

export function getClientIp(request: NextRequest | Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') || 'local'
}

export function rateLimitResponseBody(result: RateLimitResult): {
  body: { error: string }
  status: number
  headers: Record<string, string>
} {
  const seconds = result.retryAfterSeconds ?? 60
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  const message =
    minutes === 1
      ? 'Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.'
      : `Muitas tentativas. Aguarde ${minutes} minutos antes de tentar novamente.`
  return {
    body: { error: message },
    status: 429,
    headers: {
      'Retry-After': String(seconds),
    },
  }
}
