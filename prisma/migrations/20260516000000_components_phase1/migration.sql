-- Phase 1 do controle de estoque de componentes (SPEC-001).
-- Cria Component (matéria-prima) + StockMovement (log imutável) +
-- AlertSettings (singleton de e-mails para alertas).

CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "stock" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "lowStockThreshold" DECIMAL(12,4),
    "supplier" TEXT,
    "supplierUrl" TEXT,
    "costPerUnit" DECIMAL(10,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Component_sku_key" ON "Component"("sku");
CREATE INDEX "Component_isActive_idx" ON "Component"("isActive");

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "balanceAfter" DECIMAL(12,4) NOT NULL,
    "reason" TEXT,
    "relatedTaskId" TEXT,
    "relatedOrderNumber" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_componentId_createdAt_idx" ON "StockMovement"("componentId", "createdAt");
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");
CREATE INDEX "StockMovement_relatedOrderNumber_idx" ON "StockMovement"("relatedOrderNumber");

ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_relatedTaskId_fkey"
    FOREIGN KEY ("relatedTaskId") REFERENCES "ProductionTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlertSettings: singleton (id = 'default'). lowStockEmails e
-- orderAlertEmails são arrays JSON de strings.
CREATE TABLE "AlertSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "lowStockEmails" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "orderAlertEmails" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("id")
);
