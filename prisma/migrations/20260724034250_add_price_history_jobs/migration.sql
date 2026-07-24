-- CreateEnum
CREATE TYPE "FetchJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductChangeType" AS ENUM ('PRICE', 'STOCK', 'IMAGE', 'TITLE', 'DESCRIPTION');

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "availability" TEXT,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_fetch_jobs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "status" "FetchJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_fetch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_changes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "changeType" "ProductChangeType" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,

    CONSTRAINT "product_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_history_productId_recordedAt_idx" ON "price_history"("productId", "recordedAt");

-- CreateIndex
CREATE INDEX "price_history_productId_idx" ON "price_history"("productId");

-- CreateIndex
CREATE INDEX "product_fetch_jobs_status_nextRunAt_idx" ON "product_fetch_jobs"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "product_fetch_jobs_productId_idx" ON "product_fetch_jobs"("productId");

-- CreateIndex
CREATE INDEX "product_fetch_jobs_nextRunAt_idx" ON "product_fetch_jobs"("nextRunAt");

-- CreateIndex
CREATE INDEX "product_changes_productId_createdAt_idx" ON "product_changes"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "product_changes_productId_idx" ON "product_changes"("productId");

-- CreateIndex
CREATE INDEX "product_changes_changeType_idx" ON "product_changes"("changeType");

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_fetch_jobs" ADD CONSTRAINT "product_fetch_jobs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_changes" ADD CONSTRAINT "product_changes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
