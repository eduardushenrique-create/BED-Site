import 'server-only'

import sanitizeHtml from 'sanitize-html'

// Subconjunto seguro de HTML para textos ricos editados pelo admin
// (descrição de produto etc.). Remove <script>, handlers on*, <iframe>,
// <style> e qualquer tag/atributo fora da allowlist — fecha o vetor de
// XSS armazenado (A1) preservando formatação básica.
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div',
    'ul', 'ol', 'li', 'blockquote', 'h3', 'h4', 'h5', 'h6', 'a',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Links abrem em nova aba com rel seguro (evita reverse tabnabbing).
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
}

/** Sanitiza HTML rico vindo de input do admin antes de renderizar como HTML. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS)
}
