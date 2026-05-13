-- Adiciona discountReason em Order — motivo livre do desconto manual aplicado
-- pelo admin no momento de criar o pedido (brinde, troca, cortesia, fidelidade).
-- Cupom publico (Coupon) continua sem refletir aqui — usa Payment.rawPayload
-- pra preservar o snapshot do codigo aplicado.
ALTER TABLE "Order" ADD COLUMN "discountReason" TEXT;
