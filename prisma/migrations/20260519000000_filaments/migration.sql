-- Fase 1 da calculadora de custo: catálogo de filamentos.
-- Custo por grama é calculado em runtime (pricePerKg / 1000), não
-- persistido — evita reescrever ao mudar preço.

CREATE TABLE "Filament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "type" TEXT NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filament_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Filament_isActive_idx" ON "Filament"("isActive");
CREATE INDEX "Filament_type_idx" ON "Filament"("type");
