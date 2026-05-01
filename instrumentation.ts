// Next.js instrumentation entry point.
// Conditionally boots Sentry server/edge SDKs based on NEXT_RUNTIME.
// DSN-optional: each runtime config is a no-op if SENTRY_DSN is unset.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Forward Next.js request errors to Sentry (no-op when DSN unset).
export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN || !process.env.SENTRY_DSN.trim()) return
  const Sentry = await import('@sentry/nextjs')
  const captureRequestError = (Sentry as unknown as {
    captureRequestError?: (...a: unknown[]) => unknown
  }).captureRequestError
  if (typeof captureRequestError === 'function') {
    captureRequestError(...args)
  }
}
