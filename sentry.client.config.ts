// Sentry browser SDK initialization.
// DSN-optional: when NEXT_PUBLIC_SENTRY_DSN is empty, Sentry stays inert.
import * as Sentry from '@sentry/nextjs'
import { scrubPII } from '@/lib/sentry-scrub'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn && dsn.trim()) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      return scrubPII(event)
    },
    beforeBreadcrumb(crumb) {
      // Light-touch breadcrumb scrub: redact message + data strings.
      if (crumb && typeof crumb.message === 'string') {
        // delegate via a fake event-shaped wrapper
        const wrapped = scrubPII({ breadcrumbs: [crumb] })
        return wrapped?.breadcrumbs?.[0] ?? crumb
      }
      return crumb
    },
  })
}
