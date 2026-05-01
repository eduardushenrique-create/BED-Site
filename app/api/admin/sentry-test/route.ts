import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/api-auth'
import { captureException, captureMessage } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Admin-only Sentry smoke test.
 *
 *   GET /api/admin/sentry-test?type=error    -> throws (and reports) a test error
 *   GET /api/admin/sentry-test?type=message  -> sends an info-level test message
 *
 * When SENTRY_DSN is not configured the helpers fall back to console-only.
 * Use the Sentry "Issues" view to confirm reception after configuring the DSN.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  const type = request.nextUrl.searchParams.get('type') || 'error'
  const dsnConfigured = Boolean(
    (process.env.SENTRY_DSN && process.env.SENTRY_DSN.trim()) ||
      (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_DSN.trim()),
  )

  if (type === 'message') {
    captureMessage('Sentry smoke test (info)', 'info', {
      context: 'admin.sentry-test',
      triggeredBy: auth.user?.id ?? 'unknown',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({
      ok: true,
      type: 'message',
      dsnConfigured,
      hint: dsnConfigured
        ? 'Check Sentry "Issues" for the test message.'
        : 'No DSN configured — message logged to console only.',
    })
  }

  if (type === 'error') {
    const error = new Error('Sentry smoke test (intentional error)')
    captureException(error, {
      context: 'admin.sentry-test',
      triggeredBy: auth.user?.id ?? 'unknown',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({
      ok: true,
      type: 'error',
      dsnConfigured,
      hint: dsnConfigured
        ? 'Check Sentry "Issues" for the test exception.'
        : 'No DSN configured — error logged to console only.',
    })
  }

  return NextResponse.json(
    { error: 'Unknown type. Use ?type=error or ?type=message.' },
    { status: 400 },
  )
}
