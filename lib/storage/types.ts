// Tipos compartilhados pelos adapters de storage (R2 e fallback inline).

export type StorageUploadInput = {
  /**
   * Conteúdo a ser persistido. Pode ser um Buffer já decodificado ou uma data URL
   * base64 completa (`data:image/jpeg;base64,...`). O adapter extrai o Buffer da
   * data URL automaticamente.
   */
  data: Buffer | string
  /** Mime type real do binário (ex.: `image/jpeg`, `image/png`, `image/webp`). */
  contentType: string
  /** Pasta lógica dentro do bucket (ex.: `products`, `banners`). */
  prefix?: string
}

export type StorageProvider = 'r2' | 'vercel-blob' | 'inline'

export type StorageUploadResult = {
  /**
   * URL pública para uso direto em `<img src>` ou no banco.
   * Para `r2`: `https://<host>/<storageKey>`.
   * Para `inline`: a própria data URL `data:...`.
   */
  url: string
  /**
   * Chave do objeto no provider externo. `null` se o adapter inline não persistiu
   * nada externo (a "URL" já contém o conteúdo).
   */
  storageKey: string | null
  provider: StorageProvider
}

export interface StorageAdapter {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>
  delete(storageKey: string): Promise<void>
  /** `true` quando o storage é externo (R2). `false` para inline base64. */
  isExternal(): boolean
}
