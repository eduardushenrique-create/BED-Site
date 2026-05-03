-- Adiciona seletor de cor ao Filament. Hex string formato #RRGGBB,
-- nullable (filamentos antigos não têm cor cadastrada).

ALTER TABLE "Filament" ADD COLUMN "colorHex" TEXT;
