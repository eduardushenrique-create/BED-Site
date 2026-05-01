-- Production control for made-to-order and personalized items

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Product"
ADD COLUMN "productionMinutesPerUnit" INTEGER;

ALTER TABLE "ProductVariant"
ADD COLUMN "productionMinutesPerUnit" INTEGER;

CREATE TABLE "ProductionSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "dailyCapacityMinutes" INTEGER NOT NULL DEFAULT 480,
  "riskBufferHours" INTEGER NOT NULL DEFAULT 24,
  "businessDaysOnly" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductionSettings_dailyCapacityMinutes_check" CHECK ("dailyCapacityMinutes" > 0),
  CONSTRAINT "ProductionSettings_riskBufferHours_check" CHECK ("riskBufferHours" >= 0)
);

INSERT INTO "ProductionSettings" (
  "id",
  "dailyCapacityMinutes",
  "riskBufferHours",
  "businessDaysOnly",
  "createdAt",
  "updatedAt"
)
VALUES (
  'default',
  480,
  24,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "ProductionTask" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "requiredQuantity" INTEGER NOT NULL,
  "producedQuantity" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductionTask_orderItemId_key" UNIQUE ("orderItemId"),
  CONSTRAINT "ProductionTask_requiredQuantity_check" CHECK ("requiredQuantity" >= 0),
  CONSTRAINT "ProductionTask_producedQuantity_check" CHECK ("producedQuantity" >= 0 AND "producedQuantity" <= "requiredQuantity"),
  CONSTRAINT "ProductionTask_status_check" CHECK ("status" IN ('pending', 'in_production', 'paused', 'completed', 'cancelled')),
  CONSTRAINT "ProductionTask_priority_check" CHECK ("priority" IN ('low', 'normal', 'high', 'urgent'))
);

CREATE TABLE "ProductionLog" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "statusBefore" TEXT,
  "statusAfter" TEXT,
  "note" TEXT,
  "createdByEmail" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionTask_orderId_idx" ON "ProductionTask"("orderId");
CREATE INDEX "ProductionTask_status_dueAt_idx" ON "ProductionTask"("status", "dueAt");
CREATE INDEX "ProductionTask_priority_dueAt_idx" ON "ProductionTask"("priority", "dueAt");
CREATE INDEX "ProductionLog_taskId_createdAt_idx" ON "ProductionLog"("taskId", "createdAt");

ALTER TABLE "ProductionTask"
ADD CONSTRAINT "ProductionTask_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionTask"
ADD CONSTRAINT "ProductionTask_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionLog"
ADD CONSTRAINT "ProductionLog_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "ProductionTask"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill conservador:
-- cria tarefas para pedidos pagos ainda pendentes/em produção
-- apenas quando o produto atual é sob encomenda ou personalizável.
INSERT INTO "ProductionTask" (
  "id",
  "orderId",
  "orderItemId",
  "requiredQuantity",
  "producedQuantity",
  "status",
  "priority",
  "dueAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'pt_' || replace(gen_random_uuid()::text, '-', ''),
  oi."orderId",
  oi."id",
  oi."quantity",
  0,
  CASE
    WHEN o."fulfillmentStatus" = 'in_production' THEN 'in_production'
    ELSE 'pending'
  END,
  CASE
    WHEN COALESCE(
      o."productionDeadline",
      CURRENT_TIMESTAMP + (COALESCE(p."productionTimeMaxDays", 3) * interval '1 day')
    ) < (CURRENT_TIMESTAMP + interval '24 hours') THEN 'urgent'
    ELSE 'normal'
  END,
  COALESCE(
    o."productionDeadline",
    CURRENT_TIMESTAMP + (COALESCE(p."productionTimeMaxDays", 3) * interval '1 day')
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "OrderItem" oi
JOIN "Order" o ON o."id" = oi."orderId"
LEFT JOIN "Product" p ON p."id" = oi."productId"
WHERE
  o."status" = 'paid'
  AND o."fulfillmentStatus" IN ('pending', 'in_production')
  AND (
    COALESCE(p."underOrder", false) = true
    OR COALESCE(p."isPersonalizable", false) = true
  )
ON CONFLICT ("orderItemId") DO NOTHING;
