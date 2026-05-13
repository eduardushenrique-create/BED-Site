-- SPEC-005 Fase 1: pagamentos parciais + soft-delete de OrderItem +
-- flag createdVia em Order. APENAS schema/backfill, sem mudanca funcional.
--
-- - Order: createdVia (governa email/visibilidade), paidAmount, dueAmount,
--   refundStatus.
-- - OrderItem: deletedAt (soft-delete).
-- - PaymentInstallment: tabela nova de recebimentos por pedido (suporta
--   parciais, estornos, multiplos metodos).
--
-- Backfill conservador: createdVia='site' para historico (compativel com
-- comportamento atual de notificacao); paidAmount=total para pedidos ja
-- pagos. Idempotente — defaults garantem que rerun nao corrompe dados.

-- Order ---------------------------------------------------------------------
ALTER TABLE "Order"
  ADD COLUMN "createdVia"   TEXT          NOT NULL DEFAULT 'site',
  ADD COLUMN "paidAmount"   DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "dueAmount"    DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "refundStatus" TEXT;

-- Backfill: para pedidos ja pagos, paidAmount = total (e dueAmount = 0).
-- Demais pedidos: paidAmount = 0 (default), dueAmount = total.
UPDATE "Order"
   SET "paidAmount" = "total",
       "dueAmount"  = 0
 WHERE "paymentStatus" = 'paid';

UPDATE "Order"
   SET "dueAmount" = "total" - "paidAmount"
 WHERE "paymentStatus" <> 'paid';

CREATE INDEX "Order_createdVia_idx" ON "Order"("createdVia");

-- OrderItem -----------------------------------------------------------------
ALTER TABLE "OrderItem"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "OrderItem_deletedAt_idx" ON "OrderItem"("deletedAt");

-- PaymentInstallment --------------------------------------------------------
CREATE TABLE "PaymentInstallment" (
  "id"              TEXT          NOT NULL,
  "orderId"         TEXT          NOT NULL,
  "sequence"        INTEGER       NOT NULL,
  "amount"          DECIMAL(10,2) NOT NULL,
  "method"          TEXT          NOT NULL,
  "description"     TEXT,
  "receivedAt"      TIMESTAMP(3)  NOT NULL,
  "receivedByEmail" TEXT          NOT NULL,
  "notes"           TEXT,
  "isRefund"        BOOLEAN       NOT NULL DEFAULT false,
  "deletedAt"       TIMESTAMP(3),
  "paymentId"       TEXT,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentInstallment_orderId_sequence_idx" ON "PaymentInstallment"("orderId", "sequence");
CREATE INDEX "PaymentInstallment_receivedAt_idx"       ON "PaymentInstallment"("receivedAt");
CREATE INDEX "PaymentInstallment_deletedAt_idx"        ON "PaymentInstallment"("deletedAt");

ALTER TABLE "PaymentInstallment"
  ADD CONSTRAINT "PaymentInstallment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentInstallment"
  ADD CONSTRAINT "PaymentInstallment_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
