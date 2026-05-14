-- SPEC-007 — Calculadora de precificacao + pedidos manuais (Onda 2)
-- Migration unica e consolidada (PR-1 da SPEC-007).
--
-- O que faz:
--   1. PricingSettings (tabela singleton, seed com defaults da planilha)
--   2. PricingEstimate (orcamentos avulsos com snapshots historicos)
--   3. Order: +4 colunas (manualChannel, referredBy, internalNotes, createdByEmail) +1 indice
--   4. OrderItem: productId -> NULLABLE, +5 colunas (itemType, description, productionNotesItem, priceOverridden, estimateId), +1 indice, +1 FK
--   5. Backfill: itemType = 'catalog' para todos OrderItems existentes (default ja cobre INSERT, UPDATE garante linhas antigas)
--
-- Por que migration unica:
--   memoria project_railway_dockerfile_limits.md + ADR-003 v2: dividir em
--   varias migrations aumenta janela de incidente. Esta migration eh
--   idempotente (NOT EXISTS / DEFAULT / nullable) e foi desenhada para
--   nao deixar estado intermediario invalido entre os comandos.
--
-- Sem BOM (ci/check-required-order-columns.sh + Migration BOM check do CI).

-- 1. PricingSettings (singleton)
CREATE TABLE "PricingSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
  "defaultEnergyCostPerHour" DECIMAL(10,4) NOT NULL,
  "defaultDepreciationPerHour" DECIMAL(10,4) NOT NULL,
  "defaultErrorRate" DECIMAL(5,4) NOT NULL,
  "energyTariffPerKwh" DECIMAL(10,4) NOT NULL,
  "marginTiersJson" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedByEmail" TEXT
);

-- Seed do singleton com defaults discutidos com stakeholder na sessao de desenho:
--   energia default 0.35 R$/h, depreciacao default 1.00 R$/h, taxa erro 30%,
--   tarifa 0.95 R$/kWh, faixas de margem 100%/60%/50%/40% por faixa de custo.
INSERT INTO "PricingSettings" (
  "id", "defaultEnergyCostPerHour", "defaultDepreciationPerHour",
  "defaultErrorRate", "energyTariffPerKwh", "marginTiersJson", "updatedAt"
) VALUES (
  'singleton', 0.35, 1.00, 0.30, 0.95,
  '[{"maxCost":15,"marginPercent":1.00},{"maxCost":40,"marginPercent":0.60},{"maxCost":100,"marginPercent":0.50},{"maxCost":null,"marginPercent":0.40}]'::jsonb,
  NOW()
);

-- 2. PricingEstimate (orcamentos avulsos)
CREATE TABLE "PricingEstimate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "productId" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "customerEmail" TEXT,
  "notes" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "filamentId" TEXT,
  "filamentGrams" DECIMAL(10,2) NOT NULL,
  "printHours" DECIMAL(10,2) NOT NULL,
  "printerId" TEXT,
  "componentsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "filamentPricePerKgSnapshot" DECIMAL(10,2) NOT NULL,
  "energyCostPerHourSnapshot" DECIMAL(10,4) NOT NULL,
  "depreciationPerHourSnapshot" DECIMAL(10,4) NOT NULL,
  "errorRate" DECIMAL(5,4) NOT NULL,
  "marginPercent" DECIMAL(5,4) NOT NULL,
  "costFilament" DECIMAL(10,2) NOT NULL,
  "costEnergy" DECIMAL(10,2) NOT NULL,
  "costDepreciation" DECIMAL(10,2) NOT NULL,
  "costError" DECIMAL(10,2) NOT NULL,
  "costComponents" DECIMAL(10,2) NOT NULL,
  "costTotal" DECIMAL(10,2) NOT NULL,
  "suggestedPrice" DECIMAL(10,2) NOT NULL,
  "finalPrice" DECIMAL(10,2),
  "convertedToOrderId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "createdByEmail" TEXT,
  "updatedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PricingEstimate_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PricingEstimate_filamentId_fkey"
    FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PricingEstimate_printerId_fkey"
    FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PricingEstimate_convertedToOrderId_fkey"
    FOREIGN KEY ("convertedToOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PricingEstimate_convertedToOrderId_key" ON "PricingEstimate"("convertedToOrderId");
CREATE INDEX "PricingEstimate_productId_idx" ON "PricingEstimate"("productId");
CREATE INDEX "PricingEstimate_status_idx" ON "PricingEstimate"("status");
CREATE INDEX "PricingEstimate_createdAt_idx" ON "PricingEstimate"("createdAt");

-- 3. Order: +4 colunas + indice
ALTER TABLE "Order" ADD COLUMN "manualChannel" TEXT;
ALTER TABLE "Order" ADD COLUMN "referredBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "internalNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "createdByEmail" TEXT;
CREATE INDEX "Order_manualChannel_idx" ON "Order"("manualChannel");

-- 4. OrderItem: productId -> NULLABLE + 5 colunas novas + indice + FK
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "OrderItem" ADD COLUMN "itemType" TEXT NOT NULL DEFAULT 'catalog';
ALTER TABLE "OrderItem" ADD COLUMN "description" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "productionNotesItem" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "priceOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "estimateId" TEXT;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_estimateId_fkey"
  FOREIGN KEY ("estimateId") REFERENCES "PricingEstimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OrderItem_itemType_idx" ON "OrderItem"("itemType");

-- 5. Backfill defensivo. O DEFAULT 'catalog' ja cobre INSERTs futuros e tambem
--    e' aplicado ao adicionar a coluna NOT NULL, mas mantemos o UPDATE
--    explicito para deixar claro o comportamento (e cobrir caso teorico de
--    linha pre-existente com NULL antes do default — Postgres nao deveria
--    permitir, mas defesa em profundidade).
UPDATE "OrderItem" SET "itemType" = 'catalog' WHERE "itemType" IS NULL;
