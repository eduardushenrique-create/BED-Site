/**
 * Observability helpers — DSN-optional Sentry wrappers.
 *
 * These functions always log to console (preserving today's behavior in
 * Railway logs) and additionally forward to Sentry when a DSN is configured.
 */
import * as Sentry from '@sentry/nextjs'

function sentryEnabled(): boolean {
  return Boolean(
    (process.env.SENTRY_DSN && process.env.SENTRY_DSN.trim()) ||
      (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_DSN.trim()),
  )
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  console.error('[error]', error, context)
  if (sentryEnabled()) {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  }
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
) {
  console.log(`[${level}]`, message, context)
  if (sentryEnabled()) {
    Sentry.captureMessage(message, { level, extra: context })
  }
}
