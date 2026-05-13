-- =============================================================================
-- Recuperação dos 4 pedidos perdidos no JSON local — incidente 2026-05-13
-- =============================================================================
--
-- Contexto: estes 4 pedidos foram criados pela tela admin enquanto o site
-- estava rodando com `createOrder` caindo no fallback localDb (JSON dentro
-- do container Docker). O container do Railway é efêmero, então eles
-- ficariam invisíveis no Postgres e sumiriam no próximo deploy.
--
-- Este script recupera os dados extraídos via `GET /api/pedidos` (que
-- estava lendo do JSON) e os insere no Postgres. Após a aplicação:
--   - Os pedidos viram fonte-da-verdade no Postgres
--   - O JSON do container pode ser ignorado (será limpo no próximo deploy)
--   - O hotfix do PR #127 garante que isso não aconteça de novo
--
-- COMO RODAR:
--   1. Railway → projeto → serviço Postgres → tab Data ou Query
--   2. Colar este script INTEIRO
--   3. Confirmar que o BEGIN...COMMIT está bem fechado antes de executar
--   4. Após executar, conferir no /admin/pedidos que os 4 aparecem
--
-- O script é idempotente — pode rodar mais de uma vez sem duplicar
-- pedidos (usa ON CONFLICT no orderNumber).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Verificação prévia: produtos referenciados existem?
-- Se algum ID retornar 0 linhas, o INSERT do OrderItem vai falhar pelo
-- FK constraint. Confira antes de seguir com COMMIT.
-- -----------------------------------------------------------------------------
SELECT id, name FROM "Product" WHERE id IN (
  'cmovgk0d1000f01mu6ywmjq5j',  -- Personalizados em Geral (BD-MP44SI4A, BD-MP44D664)
  'cmos1svsr00081yr0qg769h00',  -- PORTA FIGURINHAS - SINGLE (PERSONALIZAVEL) (BD-MP44MSTM)
  'cmos1p20400051yr0c7tc4urm'   -- PORTA FIGURINHAS - SINGLE (BD-MP44LXYQ)
);
-- Esperado: 3 linhas. Se faltar alguma, abortar com ROLLBACK e me avisar.

-- =============================================================================
-- Pedido 1: BD-MP44SI4A — Gisele (mãe Isis) — pickup — total R$ 0 (presente)
-- =============================================================================
INSERT INTO "Order" (
  id, "orderNumber",
  "customerName", "customerEmail", "customerPhone",
  status, "paymentStatus", "fulfillmentStatus",
  subtotal, "discountTotal", "discountReason", "shippingTotal", total,
  "deliveryMethod", "orderType",
  "productionTimeline",
  "createdAt", "updatedAt"
) VALUES (
  'order_1778681117391', 'BD-MP44SI4A',
  'Gisele (mãe Isis)', 'gisele@maeisis.com', '',
  'pending', 'pending', 'aguardando_pagamento',
  99.00, 99.00, 'Presente', 0.00, 0.00,
  'pickup', 'sob_encomenda',
  '{"confirmado_at":"2026-05-13T14:05:31.455Z","aguardando_pagamento_at":"2026-05-13T14:14:40.790Z","ready_to_pickup_at":"2026-05-13T14:14:28.818Z"}'::jsonb,
  '2026-05-13T14:04:41.530Z', NOW()
)
ON CONFLICT ("orderNumber") DO NOTHING;

INSERT INTO "OrderItem" (
  id, "orderId", "productId",
  "productNameSnapshot", quantity, "unitPrice", total,
  "personalizationJson"
) VALUES (
  'oi_1778681117391_1', 'order_1778681117391', 'cmovgk0d1000f01mu6ywmjq5j',
  'Personalizados em Geral', 1, 99.00, 99.00,
  'Presente Isis'
)
ON CONFLICT (id) DO NOTHING;

-- Payment com snapshot do desconto manual (mesmo padrão do createOrder atual).
INSERT INTO "Payment" (
  id, "orderId", provider, method, status, amount,
  "rawPayload"
) VALUES (
  'pmt_1778681117391', 'order_1778681117391', 'manual', 'manual', 'pending', 0.00,
  '{"discountKind":"percentage","discountInput":100,"discountReason":"Presente","discountAppliedBy":"beddesings@gmail.com","appliedAt":"2026-05-13T14:04:41.530Z","recoveredFromLocalDb":true}'::jsonb
)
ON CONFLICT ("orderId") DO NOTHING;

-- =============================================================================
-- Pedido 2: BD-MP44MSTM — Cecília (Mãe Diogo) — shipping (endereço vazio!)
-- =============================================================================
INSERT INTO "Order" (
  id, "orderNumber",
  "customerName", "customerEmail", "customerPhone",
  status, "paymentStatus", "fulfillmentStatus",
  subtotal, "discountTotal", "shippingTotal", total,
  "deliveryMethod", "orderType",
  "createdAt", "updatedAt"
) VALUES (
  'order_1778680851328', 'BD-MP44MSTM',
  'Cecília (Mãe Diogo)', 'cecilia@diogo.com', '',
  'pending', 'pending', 'aguardando_pagamento',
  35.00, 5.00, 0.00, 30.00,
  'shipping', 'sob_encomenda',
  '2026-05-13T14:00:15.466Z', NOW()
)
ON CONFLICT ("orderNumber") DO NOTHING;

INSERT INTO "OrderItem" (
  id, "orderId", "productId",
  "productNameSnapshot", quantity, "unitPrice", total,
  "personalizationJson"
) VALUES (
  'oi_1778680851328_1', 'order_1778680851328', 'cmos1svsr00081yr0qg769h00',
  'PORTA FIGURINHAS - SINGLE (PERSONALIZAVEL)', 1, 35.00, 35.00,
  'Rosa'
)
ON CONFLICT (id) DO NOTHING;

-- Endereço de entrega: o JSON tinha shippingAddress preenchido mas com TODOS
-- os campos como string vazia. Insere assim mesmo para satisfazer o NOT NULL
-- e marca o pedido como "endereço pendente" — o admin precisa abrir e
-- preencher antes de avançar para envio.
INSERT INTO "Address" (
  id, "orderId", "zipCode", street, number, complement, neighborhood, city, state, country
) VALUES (
  'addr_1778680851328', 'order_1778680851328', '', '', '', NULL, '', '', '', 'BR'
)
ON CONFLICT ("orderId") DO NOTHING;

INSERT INTO "Payment" (
  id, "orderId", provider, method, status, amount,
  "rawPayload"
) VALUES (
  'pmt_1778680851328', 'order_1778680851328', 'manual', 'manual', 'pending', 30.00,
  '{"discountKind":"fixed","discountInput":5,"discountReason":null,"discountAppliedBy":"beddesings@gmail.com","appliedAt":"2026-05-13T14:00:15.466Z","recoveredFromLocalDb":true}'::jsonb
)
ON CONFLICT ("orderId") DO NOTHING;

-- =============================================================================
-- Pedido 3: BD-MP44LXYQ — Jéssica Mercado Livre — pickup — atacado 33un
-- =============================================================================
INSERT INTO "Order" (
  id, "orderNumber",
  "customerName", "customerEmail", "customerPhone",
  status, "paymentStatus", "fulfillmentStatus",
  subtotal, "discountTotal", "discountReason", "shippingTotal", total,
  "deliveryMethod", "orderType",
  "createdAt", "updatedAt"
) VALUES (
  'order_1778680811362', 'BD-MP44LXYQ',
  'Jéssica Mercado Livre', 'jessica@mercadolivre.com', '11 95288-2887',
  'pending', 'pending', 'aguardando_pagamento',
  990.00, 297.00, 'Venda Atacado', 0.00, 693.00,
  'pickup', 'sob_encomenda',
  '2026-05-13T13:59:35.474Z', NOW()
)
ON CONFLICT ("orderNumber") DO NOTHING;

INSERT INTO "OrderItem" (
  id, "orderId", "productId",
  "productNameSnapshot", quantity, "unitPrice", total,
  "personalizationJson"
) VALUES (
  'oi_1778680811362_1', 'order_1778680811362', 'cmos1p20400051yr0c7tc4urm',
  'PORTA FIGURINHAS - SINGLE', 33, 30.00, 990.00,
  '11 de cada cor - Branco com Preto, Azul com Dourado e Verde com Dourado'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Payment" (
  id, "orderId", provider, method, status, amount,
  "rawPayload"
) VALUES (
  'pmt_1778680811362', 'order_1778680811362', 'manual', 'manual', 'pending', 693.00,
  '{"discountKind":"fixed","discountInput":297,"discountReason":"Venda Atacado","discountAppliedBy":"beddesings@gmail.com","appliedAt":"2026-05-13T13:59:35.474Z","recoveredFromLocalDb":true}'::jsonb
)
ON CONFLICT ("orderId") DO NOTHING;

-- =============================================================================
-- Pedido 4: BD-MP44D664 — Letícia Vizinha (mãe Isaque) — pickup — sem desconto
-- =============================================================================
INSERT INTO "Order" (
  id, "orderNumber",
  "customerName", "customerEmail", "customerPhone",
  status, "paymentStatus", "fulfillmentStatus",
  subtotal, "discountTotal", "shippingTotal", total,
  "deliveryMethod", "orderType",
  "productionTimeline",
  "createdAt", "updatedAt"
) VALUES (
  'order_1778680402139', 'BD-MP44D664',
  'Letícia Vizinha (mãe Isaque)', 'leticia@vizinha.com', '',
  'pending', 'pending', 'aguardando_pagamento',
  99.00, 0.00, 0.00, 99.00,
  'pickup', 'sob_encomenda',
  '{"confirmado_at":"2026-05-13T13:53:49.972Z","aguardando_pagamento_at":"2026-05-13T13:53:53.160Z"}'::jsonb,
  '2026-05-13T13:52:46.204Z', NOW()
)
ON CONFLICT ("orderNumber") DO NOTHING;

INSERT INTO "OrderItem" (
  id, "orderId", "productId",
  "productNameSnapshot", quantity, "unitPrice", total,
  "personalizationJson"
) VALUES (
  'oi_1778680402139_1', 'order_1778680402139', 'cmovgk0d1000f01mu6ywmjq5j',
  'Personalizados em Geral', 1, 99.00, 99.00,
  'Kit Forma massinha (carros - 4)'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Payment" (
  id, "orderId", provider, method, status, amount,
  "rawPayload"
) VALUES (
  'pmt_1778680402139', 'order_1778680402139', 'manual', 'manual', 'pending', 99.00,
  '{"recoveredFromLocalDb":true,"appliedAt":"2026-05-13T13:52:46.204Z"}'::jsonb
)
ON CONFLICT ("orderId") DO NOTHING;

-- =============================================================================
-- Verificação pós-INSERT
-- =============================================================================
SELECT
  o."orderNumber",
  o."customerName",
  o.total,
  o."paymentStatus",
  o."fulfillmentStatus",
  COUNT(oi.id) AS items_count
FROM "Order" o
LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
WHERE o."orderNumber" IN ('BD-MP44SI4A', 'BD-MP44MSTM', 'BD-MP44LXYQ', 'BD-MP44D664')
GROUP BY o."orderNumber", o."customerName", o.total, o."paymentStatus", o."fulfillmentStatus"
ORDER BY o."orderNumber";
-- Esperado: 4 linhas, cada uma com items_count = 1.

COMMIT;

-- Se algo deu errado:
--   ROLLBACK;
-- e me chama de volta com a saída do erro.
