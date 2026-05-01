-- Customer.cpf
ALTER TABLE "Customer" ADD COLUMN "cpf" TEXT;

-- Order.customerId (opcional, ON DELETE SET NULL preserva pedido se cliente apagar conta)
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for queries on Order
CREATE INDEX IF NOT EXISTS "Order_customerEmail_idx" ON "Order"("customerEmail");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");

-- CustomerAddress
CREATE TABLE "CustomerAddress" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT,
  "recipient" TEXT NOT NULL,
  "zipCode" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "complement" TEXT,
  "neighborhood" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'BR',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: liga orders existentes ao Customer pelo email (case-insensitive)
UPDATE "Order" o
SET "customerId" = c.id
FROM "Customer" c
WHERE LOWER(o."customerEmail") = LOWER(c.email)
  AND o."customerId" IS NULL;
