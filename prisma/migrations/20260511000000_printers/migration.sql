-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "buildVolume" TEXT,
    "materials" TEXT,
    "dailyCapacityMinutes" INTEGER NOT NULL DEFAULT 480,
    "status" TEXT NOT NULL DEFAULT 'active',
    "color" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Printer_status_idx" ON "Printer"("status");

-- AlterTable
ALTER TABLE "ProductionTask" ADD COLUMN "printerId" TEXT;

-- CreateIndex
CREATE INDEX "ProductionTask_printerId_idx" ON "ProductionTask"("printerId");

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
