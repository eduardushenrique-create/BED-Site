// Helpers para distinguir data URLs de URLs públicas e extrair o content type.

const DATA_URL_REGEX = /^data:([^;,]+)(?:;[^,]*)?,/i

export function isDataUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return DATA_URL_REGEX.test(value)
}

export function extractContentType(dataUrl: string, fallback = 'application/octet-stream'): string {
  const match = dataUrl.match(DATA_URL_REGEX)
  return match?.[1] || fallback
}

// Allowlist de tipos de imagem aceitos no upload (M5). SVG fica de fora de
// propósito — pode carregar <script> e seria um vetor de XSS se servido inline.
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

// Teto de tamanho do upload (M8). Data URLs maiores são rejeitadas antes de
// tocar o storage — evita DoS de banda/custo por conta admin.
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Estima o tamanho em bytes do payload de uma data URL SEM alocar o buffer
 * inteiro (importante para rejeitar payloads gigantes baratos). Para base64
 * usamos a relação 4 chars -> 3 bytes (descontando padding); para data URLs
 * textuais (url-encoded) medimos o payload decodificado.
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  if (/;base64/i.test(meta)) {
    const len = payload.length
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor((len * 3) / 4) - padding)
  }
  try {
    return Buffer.byteLength(decodeURIComponent(payload))
  } catch {
    return Buffer.byteLength(payload)
  }
}

export type ImageUploadValidation =
  | { ok: true; contentType: string; bytes: number }
  | { ok: false; error: string }

/**
 * Valida uma data URL de imagem antes do upload: tipo na allowlist (M5) e
 * tamanho dentro do teto (M8). Use sempre que aceitar uma data URL vinda do
 * cliente (rotas de upload, persistência de imagens de produto/banner).
 */
export function validateImageDataUrl(
  value: string,
  opts: { maxBytes?: number } = {},
): ImageUploadValidation {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES
  const contentType = extractContentType(value, '').toLowerCase().trim()

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return {
      ok: false,
      error: `Tipo de imagem não permitido${contentType ? `: ${contentType}` : ''}. Use JPEG, PNG, WebP, GIF ou AVIF.`,
    }
  }

  const bytes = estimateDataUrlBytes(value)
  if (bytes > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    return { ok: false, error: `Imagem muito grande (máximo ${mb} MB).` }
  }

  return { ok: true, contentType, bytes }
}
