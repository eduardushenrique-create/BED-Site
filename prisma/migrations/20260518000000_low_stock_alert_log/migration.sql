-- Phase 4 SPEC-001 — log de alertas de estoque baixo enviados.
-- Usado pra throttle de 6h: não dispara mais de 1 e-mail por
-- componente nesse intervalo, mesmo que admin faça várias produções
-- em rajada.
--
-- Singleton por componente: usamos componentId como PK natural
-- (UPSERT atualiza lastSentAt). Quando o saldo sobe acima do
-- threshold de novo, o registro NÃO é apagado — só fica obsoleto.
-- Próxima descida abaixo do threshold dispara novo alerta se a
-- diferença pra lastSentAt for >= 6h.

CREATE TABLE "LowStockAlertLog" (
    "componentId" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastBalance" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "LowStockAlertLog_pkey" PRIMARY KEY ("componentId")
);

ALTER TABLE "LowStockAlertLog"
    ADD CONSTRAINT "LowStockAlertLog_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
