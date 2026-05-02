import { randomUUID } from 'node:crypto'

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

import type { StorageAdapter, StorageUploadInput, StorageUploadResult } from './types'

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl: string
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable'

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function inferExtension(contentType: string): string {
  const normalized = contentType.toLowerCase().trim()
  return EXT_BY_CONTENT_TYPE[normalized] || 'bin'
}

function decodeIfDataUrl(input: Buffer | string, fallbackContentType: string): { buffer: Buffer; contentType: string } {
  if (Buffer.isBuffer(input)) {
    return { buffer: input, contentType: fallbackContentType }
  }

  if (typeof input === 'string' && input.startsWith('data:')) {
    const match = input.match(/^data:([^;]+);base64,(.*)$/i)
    if (!match) {
      throw new Error('R2Storage: data URL inválida (esperado base64).')
    }
    const [, mime, base64] = match
    return {
      buffer: Buffer.from(base64, 'base64'),
      contentType: mime || fallbackContentType,
    }
  }

  if (typeof input === 'string') {
    // String "crua" base64 sem prefixo data:
    return { buffer: Buffer.from(input, 'base64'), contentType: fallbackContentType }
  }

  throw new Error('R2Storage: tipo de dado de upload não suportado.')
}

export class R2Storage implements StorageAdapter {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicUrl: string

  constructor(config: R2Config) {
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName || !config.publicUrl) {
      throw new Error('R2Storage: configuração incompleta. Verifique as variáveis R2_*.')
    }

    this.bucket = config.bucketName
    this.publicUrl = trimSlash(config.publicUrl)
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const { buffer, contentType } = decodeIfDataUrl(input.data, input.contentType)
    const finalContentType = input.contentType || contentType || 'application/octet-stream'
    const ext = inferExtension(finalContentType)
    const prefix = (input.prefix || 'uploads').replace(/^\/+|\/+$/g, '')
    const id = randomUUID().replace(/-/g, '')
    const storageKey = `${prefix}/${id}.${ext}`

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: finalContentType,
        CacheControl: CACHE_CONTROL_IMMUTABLE,
      })
    )

    return {
      url: `${this.publicUrl}/${storageKey}`,
      storageKey,
      provider: 'r2',
    }
  }

  async delete(storageKey: string): Promise<void> {
    if (!storageKey) return
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      })
    )
  }

  isExternal(): boolean {
    return true
  }
}

export function readR2ConfigFromEnv(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID || ''
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || ''
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
  const bucketName = process.env.R2_BUCKET_NAME || ''
  const publicUrl = process.env.R2_PUBLIC_URL || ''

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    return null
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl }
}
