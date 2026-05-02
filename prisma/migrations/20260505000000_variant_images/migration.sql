-- Permite atrelar imagens a variações específicas
ALTER TABLE "ProductImage" ADD COLUMN "variantId" TEXT;
ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- Preço absoluto opcional (override de Product.price + priceDelta)
ALTER TABLE "ProductVariant" ADD COLUMN "priceOverride" DECIMAL(10, 2);
