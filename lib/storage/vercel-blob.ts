import 'server-only'

import { del, put } from '@vercel/blob'
import crypto from 'crypto'
import { extractContentType, isDataUrl } from './data-url'
import type { StorageAdapter, StorageUploadInput, StorageUploadResult } from './types'

/**
 * Vercel Blob adapter — DSN-opcional via `BLOB_READ_WRITE_TOKEN`.
 *
 * Comportamento:
 * - Sobe o binário para o Blob com `access: 'public'`, gera URL CDN
 *   estável (https://<store>.public.blob.vercel-storage.com/<path>).
 * - Salva no banco apenas a URL pública + o pathname (storageKey) para
 *   permitir delete posterior.
 * - Aceita Buffer ou data URL no input — mesma interface do R2.
 */
export class VercelBlobStorage implements StorageAdapter {
  isExternal(): boolean {
    return true
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const { buffer, contentType } = normalizeInput(input)
    const ext = extensionFor(contentType)
    const key = buildStorageKey(input.prefix, ext)

    const blob = await put(key, buffer, {
      access: 'public',
      contentType,
      // Defensivo: o token é injetado automaticamente quando a env existe,
      // mas explicitar evita surpresa em ambientes onde a env é renomeada.
      token: process.env.BLOB_READ_WRITE_TOKEN,
      // O caminho que passamos já é único — desliga o sufixo aleatório que
      // o @vercel/blob adiciona por padrão pra evitar colisão.
      addRandomSuffix: false,
    })

    return {
      url: blob.url,
      // pathname é o que o `del()` precisa pra apagar; usamos como storageKey.
      storageKey: blob.pathname,
      provider: 'vercel-blob',
    }
  }

  async delete(storageKey: string): Promise<void> {
    if (!storageKey) return
    try {
      // del() aceita pathname ou URL completa.
      await del(storageKey, { token: process.env.BLOB_READ_WRITE_TOKEN })
    } catch (error) {
      // Não propagamos — exclusão é best-effort. Se falhar, o objeto fica
      // órfão no bucket (preço do free é limpar manualmente depois).
      console.error('[storage:vercel-blob] delete failed:', error)
    }
  }
}

export function isVercelBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function normalizeInput(input: StorageUploadInput): { buffer: Buffer; contentType: string } {
  if (Buffer.isBuffer(input.data)) {
    return { buffer: input.data, contentType: input.contentType || 'application/octet-stream' }
  }
  if (typeof input.data === 'string' && isDataUrl(input.data)) {
    const commaIdx = input.data.indexOf(',')
    const base64 = commaIdx >= 0 ? input.data.slice(commaIdx + 1) : ''
    return {
      buffer: Buffer.from(base64, 'base64'),
      contentType: input.contentType || extractContentType(input.data),
    }
  }
  if (typeof input.data === 'string') {
    return { buffer: Buffer.from(input.data, 'base64'), contentType: input.contentType || 'application/octet-stream' }
  }
  throw new Error('VercelBlobStorage.upload: input.data precisa ser Buffer ou data URL.')
}

function extensionFor(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'bin'
  }
}

function buildStorageKey(prefix: string | undefined, ext: string): string {
  const folder = (prefix || 'uploads').replace(/(^\/|\/$)/g, '')
  const random = crypto.randomBytes(12).toString('hex')
  const stamp = Date.now().toString(36)
  return `${folder}/${stamp}-${random}.${ext}`
}
