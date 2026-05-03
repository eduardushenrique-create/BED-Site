import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number]

// Hosts liberados para `next/image`. Mantemos R2 (legado, opt-in via env) e
// liberamos o wildcard do Vercel Blob — qualquer store dele cai em
// `*.public.blob.vercel-storage.com`. Sem env extra: o subdomínio muda por
// store, e mesmo trocando de store o pattern continua valendo.
function buildRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [
    {
      protocol: 'https',
      hostname: '*.public.blob.vercel-storage.com',
    },
  ]

  const r2Url = process.env.R2_PUBLIC_URL
  if (r2Url) {
    try {
      const parsed = new URL(r2Url)
      patterns.push({
        protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
        hostname: parsed.hostname,
      })
    } catch {
      // env mal formada — ignora silenciosamente, app não regride.
    }
  }

  return patterns
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildRemotePatterns(),
  },
};

// Wrap with Sentry only when a DSN is configured. Without a DSN we keep the
// vanilla config so the app builds and runs identically to before Sentry was
// added. The wizard plugin is required at module top-level (still safe — it
// only injects build-time tooling; runtime is gated by the SDK init configs).
const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

let exported: NextConfig = nextConfig

if (sentryDsn && sentryDsn.trim()) {
  // Lazy require so projects without Sentry installed still build.
  // (In this repo Sentry is a dependency, so the require always succeeds.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require('@sentry/nextjs') as typeof import('@sentry/nextjs')
  exported = withSentryConfig(nextConfig, {
    // Silent unless explicitly debugging — keeps Railway logs clean.
    silent: true,
    // Source-map upload requires SENTRY_AUTH_TOKEN. When absent the wrapper
    // skips upload and only enables runtime instrumentation.
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Disable telemetry beacon to Sentry from the build pipeline.
    telemetry: false,
    // Don't fail the build if symbol upload fails — observability is
    // best-effort, deploys must still ship.
    errorHandler: () => {},
  } as Parameters<typeof withSentryConfig>[1])
}

export default exported;
