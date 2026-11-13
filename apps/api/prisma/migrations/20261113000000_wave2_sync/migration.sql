-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_records" (
    "userId" UUID NOT NULL,
    "collection" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL,
    "seq" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_records_pkey" PRIMARY KEY ("userId","collection","id")
);

-- CreateTable
CREATE TABLE "user_sync_state" (
    "userId" UUID NOT NULL,
    "seqCounter" BIGINT NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMPTZ(3),

    CONSTRAINT "user_sync_state_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "sync_records_userId_collection_idx" ON "sync_records"("userId", "collection");

-- CreateIndex
CREATE UNIQUE INDEX "sync_records_userId_seq_key" ON "sync_records"("userId", "seq");

