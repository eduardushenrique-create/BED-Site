-- Adiciona expectedDeliveryAt em Order — prazo de entrega prometido ao cliente
-- (especialmente útil para pedidos com produtos sob encomenda / underOrder).
-- Diferente de productionDeadline (interno, prazo de produção) e de
-- shipment.estimatedDays (frete). Este é o que o cliente vê no portal.
ALTER TABLE "Order" ADD COLUMN "expectedDeliveryAt" TIMESTAMP(3);
