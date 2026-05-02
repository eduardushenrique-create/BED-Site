// Fachada do storage de imagens.
//
// Decisão automática:
// - Se TODAS as 5 envs `R2_*` estão setadas → usa Cloudflare R2 (S3-compatible).
// - Caso contrário → cai no `InlineStorage`, que persiste a imagem como data URL
//   base64 no banco (comportamento legado, zero regressão).
//
// O singleton é inicializado no primeiro acesso. Se as envs mudarem em runtime
// (Railway redeploy), o novo processo já lê o estado novo.

import { InlineStorage } from './inline'
import { R2Storage, readR2ConfigFromEnv } from './r2'
import type { StorageAdapter } from './types'

let cachedAdapter: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter

  const r2Config = readR2ConfigFromEnv()
  if (r2Config) {
    try {
      cachedAdapter = new R2Storage(r2Config)
      return cachedAdapter
    } catch (error) {
      console.error('[storage] failed to init R2, falling back to inline:', error)
    }
  }

  cachedAdapter = new InlineStorage()
  return cachedAdapter
}

/**
 * Helper para a UI saber se R2 está pronto (ex.: mostrar um banner no admin
 * pedindo para configurar). Não chama `getStorage()` para não cachear.
 */
export function isStorageConfigured(): boolean {
  return readR2ConfigFromEnv() !== null
}

/** Apenas para testes — limpa o singleton. */
export function __resetStorageForTests(): void {
  cachedAdapter = null
}

export type { StorageAdapter, StorageUploadInput, StorageUploadResult, StorageProvider } from './types'
