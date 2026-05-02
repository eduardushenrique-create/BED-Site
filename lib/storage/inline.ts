import type { StorageAdapter, StorageUploadInput, StorageUploadResult } from './types'

/**
 * Adapter de fallback usado quando R2 não está configurado.
 *
 * Não há persistência externa: a "URL" retornada é a própria data URL base64,
 * mantendo o comportamento anterior do sistema (zero regressão para quem ainda
 * não criou conta na Cloudflare).
 */
export class InlineStorage implements StorageAdapter {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const { data, contentType } = input

    let dataUrl: string
    if (typeof data === 'string') {
      // Já é uma data URL — devolve como veio.
      if (data.startsWith('data:')) {
        dataUrl = data
      } else {
        // String "crua" base64 sem prefixo — embrulha como data URL.
        dataUrl = `data:${contentType};base64,${data}`
      }
    } else {
      const base64 = data.toString('base64')
      dataUrl = `data:${contentType};base64,${base64}`
    }

    return {
      url: dataUrl,
      storageKey: null,
      provider: 'inline',
    }
  }

  async delete(_storageKey: string): Promise<void> {
    // No-op: nada para limpar fora do banco.
  }

  isExternal(): boolean {
    return false
  }
}
