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
