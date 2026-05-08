-- Persistir orderType ('sob_encomenda' | 'pronta_entrega') no Order.
--
-- Antes: o tipo era derivado em runtime a partir das flags do produto (
-- `Product.underOrder` e `Product.isPersonalizable`). Frágil: dependia da
-- hidratação correta do Prisma include e podia falhar silenciosamente.
--
-- Agora: campo persistido. createOrder calcula e grava no momento da
-- criação. Pedidos existentes recebem backfill abaixo: 'pronta_entrega'
-- somente quando NENHUM item do pedido tem produto com underOrder=true ou
-- isPersonalizable=true. Caso contrário (algum item produzível ou base
-- inconclusiva) → 'sob_encomenda' (default seguro, pipeline mais completo).

ALTER TABLE "Order"
  ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'sob_encomenda';

-- Backfill: pedidos cujos items NÃO têm nenhum produto produzível viram
-- 'pronta_entrega'. Demais ficam com o default 'sob_encomenda'.
UPDATE "Order" o
SET "orderType" = 'pronta_entrega'
WHERE NOT EXISTS (
  SELECT 1
  FROM "OrderItem" oi
  JOIN "Product" p ON p.id = oi."productId"
  WHERE oi."orderId" = o.id
    AND (p."underOrder" = true OR p."isPersonalizable" = true)
);
