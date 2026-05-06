-- Adiciona htmlContent e remove campos de imagem/texto antigos
ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "htmlContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Banner" DROP COLUMN IF EXISTS "subtitle";
ALTER TABLE "Banner" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "Banner" DROP COLUMN IF EXISTS "storageKey";
ALTER TABLE "Banner" DROP COLUMN IF EXISTS "ctaText";
ALTER TABLE "Banner" DROP COLUMN IF EXISTS "ctaLink";
