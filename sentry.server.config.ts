// Sentry server (Node) SDK initialization.
// DSN-optional: when SENTRY_DSN is empty, Sentry stays inert.
import * as Sentry from '@sentry/nextjs'
import { scrubPII } from '@/lib/sentry-scrub'

const dsn = process.env.SENTRY_DSN

if (dsn && dsn.trim()) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return scrubPII(event)
    },
    beforeBreadcrumb(crumb) {
      if (crumb && typeof crumb.message === 'string') {
        const wrapped = scrubPII({ breadcrumbs: [crumb] })
        return wrapped?.breadcrumbs?.[0] ?? crumb
      }
      return crumb
    },
  })
}
