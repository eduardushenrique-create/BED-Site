CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resourceId" TEXT,
    "eventId" TEXT,
    "action" TEXT,
    "orderNumber" TEXT,
    "paymentId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_deliveryKey_key" ON "WebhookEvent"("deliveryKey");
CREATE INDEX "WebhookEvent_provider_topic_resourceId_idx" ON "WebhookEvent"("provider", "topic", "resourceId");
