-- Pipeline de produção: 4 fases novas entre pagamento e produção real.
-- aguardando_producao -> em_revisao -> arte_em_montagem -> liberado_producao -> in_production
-- Sem backfill: pedidos antigos ficam com productionTimeline NULL (timeline mostra "—").

ALTER TABLE "Order"
  ADD COLUMN "productionTimeline" JSONB,
  ADD COLUMN "currentStageNote"   TEXT;
