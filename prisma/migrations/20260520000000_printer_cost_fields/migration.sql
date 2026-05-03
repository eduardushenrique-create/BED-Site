-- Fase 2 da calculadora de custo: campos novos em Printer.
--
-- powerConsumptionWatts: consumo em watts (ex.: 350W). Usado pra
-- calcular custo de energia: (printingMin/60) * (watts/1000) * R$/kWh
--
-- acquisitionCostBRL: preço pago na impressora (R$). Usado pra
-- calcular depreciação por hora.
--
-- lifetimeHours: vida útil em horas (ex.: 5000). Depreciação por
-- hora = acquisitionCostBRL / lifetimeHours.

ALTER TABLE "Printer" ADD COLUMN "powerConsumptionWatts" INTEGER;
ALTER TABLE "Printer" ADD COLUMN "acquisitionCostBRL" DECIMAL(10,2);
ALTER TABLE "Printer" ADD COLUMN "lifetimeHours" INTEGER;
