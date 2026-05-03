-- Phase 2 do controle de estoque (SPEC-001).
-- Cria ProductComponent (Bill of Materials) — vincula Component a
-- Product com quantityPerUnit. variantId é opcional: se preenchido, a
-- regra vale só pra essa variação; se NULL, vale pro produto inteiro.

CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "componentId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

-- Indexes principais.
CREATE INDEX "ProductComponent_productId_idx" ON "ProductComponent"("productId");
CREATE INDEX "ProductComponent_componentId_idx" ON "ProductComponent"("componentId");

-- Unicidade da tripla (productId, variantId, componentId).
-- Postgres NULL não conta em unique índice padrão, então usamos coalesce
-- via expressão pra tratar NULL como '__nullable__'.
CREATE UNIQUE INDEX "ProductComponent_unique_bom"
    ON "ProductComponent"("productId", COALESCE("variantId", '__nullable__'), "componentId");

ALTER TABLE "ProductComponent"
    ADD CONSTRAINT "ProductComponent_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductComponent"
    ADD CONSTRAINT "ProductComponent_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrict: não deixa apagar componente que ainda é referenciado por
-- algum produto. Admin precisa remover BOM antes.
ALTER TABLE "ProductComponent"
    ADD CONSTRAINT "ProductComponent_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
