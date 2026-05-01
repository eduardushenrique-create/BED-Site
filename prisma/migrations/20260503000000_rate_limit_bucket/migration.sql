-- RateLimitBucket: coarse-grained rate limit storage shared by sensitive auth endpoints.
-- One row per (scope:identifier) key. `count` increments per request inside the window
-- defined by `resetAt`. After `resetAt` the bucket is reset on the next hit.

CREATE TABLE "RateLimitBucket" (
  "key"       TEXT NOT NULL,
  "count"     INTEGER NOT NULL DEFAULT 0,
  "resetAt"   TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
