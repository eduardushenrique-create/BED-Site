-- SPEC-002 Parte B: Produtos internos (admin-only)
-- Adiciona campo visibility ao Product. Default 'public' garante que todos
-- os produtos pré-existentes continuem aparecendo na loja.
ALTER TABLE "Product"
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';

-- Index composto cobre o filtro mais comum: catálogo público (visibility='public' AND isActive=true).
CREATE INDEX "Product_visibility_isActive_idx"
  ON "Product"("visibility", "isActive");
