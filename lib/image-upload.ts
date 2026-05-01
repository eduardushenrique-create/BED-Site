// Browser-only helpers for compressing/validating images before upload.
// We store the result as a base64 data URL — kept under a safe size limit
// (the Railway/Next request body cap is ~5MB; we target ~1MB final).

export const MAX_INPUT_BYTES = 10 * 1024 * 1024 // 10 MB raw upload max
export const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024 // ~1.5 MB after compression
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type CompressOptions = {
  maxWidth?: number
  maxHeight?: number
  quality?: number  // 0..1
  mimeType?: 'image/jpeg' | 'image/webp'
}

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageUploadError'
  }
}

export function validateImageFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageUploadError(`Formato não suportado (${file.type || 'desconhecido'}). Use JPG, PNG ou WebP.`)
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageUploadError(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`)
  }
}

export async function compressImageToDataUrl(file: File, opts: CompressOptions = {}): Promise<string> {
  validateImageFile(file)

  const maxWidth = opts.maxWidth ?? 1600
  const maxHeight = opts.maxHeight ?? 1600
  const quality = opts.quality ?? 0.85
  const mimeType = opts.mimeType ?? 'image/jpeg'

  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const { width, height } = scaleToFit(img.naturalWidth, img.naturalHeight, maxWidth, maxHeight)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageUploadError('Navegador não suporta canvas para compressão de imagem.')

  // White background to avoid black on PNG transparency when exporting JPEG
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(img, 0, 0, width, height)

  let output = canvas.toDataURL(mimeType, quality)
  let currentQuality = quality

  // If still too big, drop quality progressively
  while (estimateBase64Bytes(output) > MAX_OUTPUT_BYTES && currentQuality > 0.4) {
    currentQuality -= 0.1
    output = canvas.toDataURL(mimeType, currentQuality)
  }

  if (estimateBase64Bytes(output) > MAX_OUTPUT_BYTES) {
    throw new ImageUploadError('Não foi possível comprimir a imagem o suficiente. Use uma foto menor.')
  }

  return output
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new ImageUploadError('Não foi possível ler o arquivo selecionado.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImageUploadError('Imagem inválida ou corrompida.'))
    img.src = src
  })
}

function scaleToFit(srcW: number, srcH: number, maxW: number, maxH: number) {
  const ratio = Math.min(1, maxW / srcW, maxH / srcH)
  return {
    width: Math.round(srcW * ratio),
    height: Math.round(srcH * ratio),
  }
}

function estimateBase64Bytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || ''
  // 4 base64 chars = 3 bytes
  return Math.floor((base64.length * 3) / 4)
}
