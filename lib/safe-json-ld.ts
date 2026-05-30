/**
 * Serializa um objeto para injeção segura em
 * `<script type="application/ld+json">`.
 *
 * `JSON.stringify` NÃO escapa `<`, então um valor vindo do banco (nome de
 * categoria, nome/descrição de produto) contendo `</script><script>…`
 * quebraria o bloco e injetaria HTML executável (XSS armazenado via SEO data).
 * Escapamos `<`, `>` e `&` como `\uXXXX` — continua sendo JSON válido (os
 * consumidores decodificam de volta), mas nunca produz um `</script>` literal. (M3)
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
