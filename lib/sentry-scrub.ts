/**
 * Best-effort PII scrubber for Sentry events.
 *
 * Detects and redacts the following patterns from event strings:
 *   - E-mails:        \S+@\S+\.\S+
 *   - CPF (11 digits, optionally formatted):  000.000.000-00 / 00000000000
 *   - Telefone BR (10-11 digits, optionally formatted): (11) 99999-9999
 *   - CEP (8 digits, optionally formatted):   00000-000
 *
 * Replaces matches with `[REDACTED]` in:
 *   - event.message
 *   - event.breadcrumbs[].message
 *   - event.breadcrumbs[].data values (recursively, only string fields)
 *   - event.exception.values[].value
 *   - event.request.url query string
 *
 * Preserves:
 *   - event.user.id (so we can still group by user when id is a cuid/uuid)
 *
 * NOTE: This is best-effort. It will catch the obvious leaks but cannot
 * guarantee zero PII exfiltration. Treat Sentry projects as confidential.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// CPF: 11 digits, possibly formatted as 000.000.000-00
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
// Telefone BR: (11) 99999-9999, 11999999999, 1199999999
const PHONE_BR_RE = /\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g
// CEP: 00000-000 or 00000000
const CEP_RE = /\b\d{5}-?\d{3}\b/g

const REDACTED = '[REDACTED]'

function redactString(input: string): string {
  if (!input || typeof input !== 'string') return input
  let out = input
  out = out.replace(EMAIL_RE, REDACTED)
  // Order matters: CPF (11) before phone (10-11) before CEP (8)
  out = out.replace(CPF_RE, REDACTED)
  out = out.replace(PHONE_BR_RE, REDACTED)
  out = out.replace(CEP_RE, REDACTED)
  return out
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v)
    }
    return out
  }
  return value
}

function redactUrl(url: string): string {
  if (!url) return url
  // Apply redaction to the entire URL — query strings most often hold PII.
  return redactString(url)
}

// We deliberately type the input as `any` here: Sentry's `Event` and
// `Breadcrumb` shapes evolve across SDK versions and use non-index-signature
// types that don't compose well with structural mutation. The mutations we
// perform are narrow and runtime-safe (string replacements).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scrubPII<T = any>(event: T): T {
  if (!event || typeof event !== 'object') return event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = event as any

  if (typeof e.message === 'string') {
    e.message = redactString(e.message)
  }

  if (Array.isArray(e.breadcrumbs)) {
    for (const crumb of e.breadcrumbs) {
      if (!crumb || typeof crumb !== 'object') continue
      if (typeof crumb.message === 'string') {
        crumb.message = redactString(crumb.message)
      }
      if (crumb.data && typeof crumb.data === 'object') {
        crumb.data = redactValue(crumb.data) as Record<string, unknown>
      }
    }
  }

  if (e.exception?.values && Array.isArray(e.exception.values)) {
    for (const ex of e.exception.values) {
      if (ex && typeof ex.value === 'string') {
        ex.value = redactString(ex.value)
      }
    }
  }

  if (e.request?.url && typeof e.request.url === 'string') {
    e.request.url = redactUrl(e.request.url)
  }

  return event
}
