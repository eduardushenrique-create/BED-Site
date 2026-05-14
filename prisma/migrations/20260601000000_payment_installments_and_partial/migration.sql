-- SPEC-005 Fase 1 (PR-6 do plano da ADR-003 v2): pagamentos parciais +
-- soft-delete de OrderItem + flag createdVia em Order.
--
-- Apenas schema/backfill, SEM mudanca funcional. Codigo de feature
-- (endpoints, UI, regras de negocio) vem nas fases 2-4 (PRs 7a/7b/8a/8b).
--
-- Backfill conservador:
--   - createdVia='site' default cobre todo historico (compativel com
--     comportamento atual de notificacao). Pedidos manuais legados
--     (que admin lembra que criou no painel) terao que ser marcados
--     manualmente via SQL se desejado, mas o stakeholder confirmou
--     que isso nao eh prioridade.
--   - paidAmount = total para pedidos com paymentStatus='paid'.
--   - dueAmount = total - paidAmount para os demais.
--
-- Constraints de seguranca (R17 e R8 do ADR-003 v2):
--   - CHECK em PaymentInstallment.amount (0 < amount <= 100000) bloqueia
--     amount tampering em qualquer caminho (UI, webhook, script). 100k
--     eh limite generoso pra um pedido individual.
--   - INDICE UNICO PARCIAL em PaymentInstallment(paymentId) WHERE NOT NULL
--     impede webhook MP duplicado de criar 2 installments.

-- Order ---------------------------------------------------------------------
ALTER TABLE "Order"
  ADD COLUMN "createdVia"   TEXT          NOT NULL DEFAULT 'site',
  ADD COLUMN "paidAmount"   DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "dueAmount"    DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "refundStatus" TEXT;

-- Backfill: paidAmount = total para pedidos pagos; dueAmount = total para
-- nao pagos. Default 0 ja cobre o caso `paymentStatus='paid'` que zera dueAmount.
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

  CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentInstallment_amount_range_check"
    CHECK ("amount" > 0 AND "amount" <= 100000)
);

CREATE INDEX "PaymentInstallment_orderId_sequence_idx" ON "PaymentInstallment"("orderId", "sequence");
CREATE INDEX "PaymentInstallment_receivedAt_idx"       ON "PaymentInstallment"("receivedAt");
CREATE INDEX "PaymentInstallment_deletedAt_idx"        ON "PaymentInstallment"("deletedAt");

-- R8 do ADR-003 v2: indice unico parcial bloqueia webhook MP duplicado.
-- Pagamentos manuais ficam com paymentId NULL (nao restritos pelo unique).
CREATE UNIQUE INDEX "PaymentInstallment_paymentId_key"
  ON "PaymentInstallment"("paymentId")
  WHERE "paymentId" IS NOT NULL;

ALTER TABLE "PaymentInstallment"
  ADD CONSTRAINT "PaymentInstallment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentInstallment"
  ADD CONSTRAINT "PaymentInstallment_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
