CREATE TABLE "AuthCode" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthCode_email_usedAt_expiresAt_idx" ON "AuthCode"("email", "usedAt", "expiresAt");
