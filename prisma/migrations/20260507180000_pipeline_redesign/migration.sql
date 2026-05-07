-- Pipeline redesign: dois pipelines (sob encomenda / pronta entrega).
--
-- Mudancas:
--   1. Adiciona Order.deliveryMethod ('shipping' | 'pickup') com default 'shipping'.
--   2. Migra dados existentes:
--      - fulfillmentStatus 'em_revisao'         -> 'pending'
--      - fulfillmentStatus 'aguardando_producao' -> 'na_fila'
--   Os outros status (pending, arte_em_montagem, liberado_producao, in_production,
--   ready_to_ship, shipped, delivered, cancelled) ficam inalterados.
--
-- Os 4 status novos do redesign (confirmado, aguardando_pagamento, na_fila,
-- ready_to_pickup) nao recebem dados retroativos — pedidos antigos so podem
-- entrar neles via transicao manual a partir desta versao.

ALTER TABLE "Order"
  ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'shipping';

UPDATE "Order"
  SET "fulfillmentStatus" = 'pending'
  WHERE "fulfillmentStatus" = 'em_revisao';

UPDATE "Order"
  SET "fulfillmentStatus" = 'na_fila'
  WHERE "fulfillmentStatus" = 'aguardando_producao';
