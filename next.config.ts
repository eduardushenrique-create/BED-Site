import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
