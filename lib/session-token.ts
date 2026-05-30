import crypto from 'crypto'

export type SessionTokenPayload = {
  id: string
  email: string
  name: string
  role: string
  exp: number
}

function getSecret(name: string, fallback: string) {
  const value = process.env[name] || process.env.NEXTAUTH_SECRET
  if (value) return value
  // M4 — sem valor configurado, o fallback público de DEV só é aceitável em
  // desenvolvimento/teste local. Em produção, staging ou qualquer ambiente
  // implantado, assinar sessões com um segredo conhecido deixaria qualquer um
  // forjar um cookie de admin — então recusamos inicializar.
  const env = process.env.NODE_ENV
  if (env === 'development' || env === 'test') return fallback
  throw new Error(`${name} precisa estar configurado fora de desenvolvimento.`)
}

export function getSessionSecret() {
  return getSecret('AUTH_SESSION_SECRET', 'dev-session-secret-change-me')
}

export function getCodePepper() {
  return getSecret('AUTH_CODE_PEPPER', 'dev-code-pepper-change-me')
}

function sign(value: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function encodeSessionToken(payload: SessionTokenPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function decodeSessionToken(value?: string | null): SessionTokenPayload | null {
  if (!value) return null

  const [body, signature] = value.split('.')
  if (!body || !signature || !safeEqual(sign(body), signature)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionTokenPayload
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
