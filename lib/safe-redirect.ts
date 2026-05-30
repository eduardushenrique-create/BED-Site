/**
 * Garante que um valor de redirect é um caminho INTERNO seguro, prevenindo
 * open redirect (OWASP A01). Aceita apenas caminhos que começam com uma
 * única `/`, rejeitando:
 *   - URLs absolutas      → `https://evil.com`
 *   - protocol-relative   → `//evil.com`
 *   - truques de backslash → `/\evil.com` (alguns browsers tratam como `//`)
 *
 * Retorna `fallback` quando o valor é inválido/ausente.
 *
 * Puro (sem dependências) — seguro de usar tanto no servidor (route handlers)
 * quanto no cliente.
 */
export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback
  if (value[0] !== '/') return fallback
  // rejeita `//...` e `/\...` (protocol-relative / bypass por backslash)
  if (value[1] === '/' || value[1] === '\\') return fallback
  return value
}
