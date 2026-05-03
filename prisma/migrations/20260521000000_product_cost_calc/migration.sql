-- Fase 3 da calculadora de custo: vincula filamentos a produtos +
-- novos campos de cálculo em Product.

-- ProductFilament: multi-filamento por produto (q1 = B na spec).
-- variantId opcional: NULL = vínculo global do produto, preenchido =
-- só vale pra essa variação. Mesma lógica de BOM da SPEC-001.
CREATE TABLE "ProductFilament" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "filamentId" TEXT NOT NULL,
    "grams" DECIMAL(10,3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFilament_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductFilament_productId_idx" ON "ProductFilament"("productId");
CREATE INDEX "ProductFilament_filamentId_idx" ON "ProductFilament"("filamentId");

-- Unique igual ao BOM (SPEC-001) — Postgres NULL não conta em unique
-- padrão, então usamos COALESCE.
CREATE UNIQUE INDEX "ProductFilament_unique"
    ON "ProductFilament"("productId", COALESCE("variantId", '__nullable__'), "filamentId");

ALTER TABLE "ProductFilament"
    ADD CONSTRAINT "ProductFilament_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductFilament"
    ADD CONSTRAINT "ProductFilament_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrict: não deixa apagar Filament que está em uso por algum produto.
ALTER TABLE "ProductFilament"
    ADD CONSTRAINT "ProductFilament_filamentId_fkey"
    FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Product: campos de cálculo. Todos opcionais.
ALTER TABLE "Product" ADD COLUMN "printerForCostId" TEXT;
ALTER TABLE "Product" ADD COLUMN "printingMinutes" INTEGER;
ALTER TABLE "Product" ADD COLUMN "markupPercent" DECIMAL(6,2);
ALTER TABLE "Product" ADD COLUMN "errorRatePercent" DECIMAL(6,2) DEFAULT 30.00;

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_printerForCostId_fkey"
    FOREIGN KEY ("printerForCostId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
