-- Adiciona a coluna `storageKey` em ProductImage e Banner para permitir que o
-- backend rastreie a chave do objeto no Cloudflare R2 (ou outro storage S3-
-- compatible). Quando a imagem ainda estiver inline (data URL base64) o campo
-- permanece NULL — o adapter inline nao tem chave externa.

ALTER TABLE "ProductImage" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "Banner" ADD COLUMN "storageKey" TEXT;
