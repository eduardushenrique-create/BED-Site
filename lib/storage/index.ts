// Fachada do storage de imagens.
//
// Prioridade de adapter (primeiro que estiver configurado vence):
//   1. Vercel Blob — basta `BLOB_READ_WRITE_TOKEN` (1 env, mais simples)
//   2. Cloudflare R2 — exige TODAS as 5 envs `R2_*`
//   3. Inline — fallback que persiste como data URL base64 no banco (zero
//      regressão, comportamento legado)
//
// O singleton é inicializado no primeiro acesso. Se as envs mudarem em runtime
// (Railway redeploy), o novo processo já lê o estado novo.

import { InlineStorage } from './inline'
import { R2Storage, readR2ConfigFromEnv } from './r2'
import { VercelBlobStorage, isVercelBlobConfigured } from './vercel-blob'
import type { StorageAdapter } from './types'

let cachedAdapter: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter

  if (isVercelBlobConfigured()) {
    try {
      cachedAdapter = new VercelBlobStorage()
      return cachedAdapter
    } catch (error) {
      console.error('[storage] failed to init Vercel Blob, trying R2/inline:', error)
    }
  }

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
 * Helper para a UI saber se algum storage externo (Vercel Blob ou R2) está
 * configurado. Não chama `getStorage()` para não cachear.
 */
export function isStorageConfigured(): boolean {
  return isVercelBlobConfigured() || readR2ConfigFromEnv() !== null
}

/** Apenas para testes — limpa o singleton. */
export function __resetStorageForTests(): void {
  cachedAdapter = null
}

export type { StorageAdapter, StorageUploadInput, StorageUploadResult, StorageProvider } from './types'
