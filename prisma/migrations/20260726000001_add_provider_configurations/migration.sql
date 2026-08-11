-- CreateTable
CREATE TABLE "provider_configurations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "encryptedConfig" TEXT NOT NULL,
    "configIv" TEXT NOT NULL,
    "configAuthTag" TEXT NOT NULL,
    "rateLimit" JSONB,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "retries" JSONB,
    "metadata" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheck" TIMESTAMP(3),
    "lastStatus" "ProviderStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "provider_configurations_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "provider_usage" ADD COLUMN "providerConfigId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "provider_configurations_userId_category_providerId_key" ON "provider_configurations"("userId", "category", "providerId");

-- CreateIndex
CREATE INDEX "provider_configurations_userId_idx" ON "provider_configurations"("userId");

-- CreateIndex
CREATE INDEX "provider_configurations_userId_category_idx" ON "provider_configurations"("userId", "category");

-- CreateIndex
CREATE INDEX "provider_configurations_userId_enabled_idx" ON "provider_configurations"("userId", "enabled");

-- CreateIndex
CREATE INDEX "provider_configurations_userId_category_priority_idx" ON "provider_configurations"("userId", "category", "priority");

-- CreateIndex
CREATE INDEX "provider_configurations_providerId_idx" ON "provider_configurations"("providerId");

-- CreateIndex
CREATE INDEX "provider_configurations_category_idx" ON "provider_configurations"("category");

-- CreateIndex
CREATE INDEX "provider_configurations_lastStatus_idx" ON "provider_configurations"("lastStatus");

-- CreateIndex
CREATE INDEX "provider_usage_providerConfigId_idx" ON "provider_usage"("providerConfigId");

-- AddForeignKey
ALTER TABLE "provider_configurations" ADD CONSTRAINT "provider_configurations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_providerConfigId_fkey" FOREIGN KEY ("providerConfigId") REFERENCES "provider_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
