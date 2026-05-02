import 'server-only'

import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'upstash' })

/**
 * Upstash Redis REST client — minimal, dependency-free.
 *
 * DSN-opcional: sem `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`,
 * `isUpstashConfigured()` retorna false e o resto do app cai pro
 * RateLimitBucket do Postgres.
 *
 * Reference: https://upstash.com/docs/redis/features/restapi
 */

export function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function baseUrl(): string {
  const url = process.env.UPSTASH_REDIS_REST_URL || ''
  return url.replace(/\/$/, '')
}

function authHeader(): string {
  return `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN || ''}`
}

type PipelineCommand = (string | number)[]

/**
 * Executes one or more commands in a single HTTP roundtrip.
 * Returns the array of `{ result }` payloads from Upstash, in order.
 */
export async function pipeline(commands: PipelineCommand[]): Promise<unknown[]> {
  if (!isUpstashConfigured()) throw new Error('upstash_not_configured')
  if (commands.length === 0) return []

  const response = await fetch(`${baseUrl()}/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(commands),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    log.warn({ status: response.status, body: text }, 'Upstash pipeline non-OK')
    throw new Error(`upstash_http_${response.status}`)
  }

  const data = (await response.json().catch(() => null)) as Array<{ result?: unknown; error?: string }> | null
  if (!Array.isArray(data)) throw new Error('upstash_bad_payload')

  return data.map(entry => {
    if (entry?.error) throw new Error(`upstash_error: ${entry.error}`)
    return entry?.result
  })
}

export async function command(...parts: (string | number)[]): Promise<unknown> {
  const result = await pipeline([parts])
  return result[0]
}
