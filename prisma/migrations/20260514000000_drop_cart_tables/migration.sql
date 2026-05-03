-- Drop legado das tabelas Cart/CartItem do projeto inicial Supabase.
-- O carrinho real vive em React Context (CartContext) e nunca foi
-- persistido — auditoria do código confirmou zero leituras/escritas
-- de prisma.cart.* ou prisma.cartItem.*. Stakeholder aprovou a remoção
-- explicitamente em 2026-05-03.

DROP TABLE IF EXISTS "CartItem";
DROP TABLE IF EXISTS "Cart";
