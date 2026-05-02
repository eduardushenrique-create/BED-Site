-- CreateTable
CREATE TABLE "RestockAlert" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestockAlert_email_productId_variantId_key" ON "RestockAlert"("email", "productId", "variantId");

-- CreateIndex
CREATE INDEX "RestockAlert_productId_idx" ON "RestockAlert"("productId");

-- CreateIndex
CREATE INDEX "RestockAlert_variantId_idx" ON "RestockAlert"("variantId");

-- CreateIndex
CREATE INDEX "RestockAlert_notifiedAt_idx" ON "RestockAlert"("notifiedAt");
