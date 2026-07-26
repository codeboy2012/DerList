-- Add provider management enums
CREATE TYPE "ProviderCategory" AS ENUM ('AI', 'SHOPPING_SEARCH', 'PRICE', 'VISION');
CREATE TYPE "ProviderStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');
CREATE TYPE "ProviderUsageType" AS ENUM ('CHAT', 'PRODUCT_IDENTIFICATION', 'PRODUCT_NORMALIZATION', 'RECOMMENDATION', 'DATA_EXTRACTION', 'PRODUCT_SEARCH', 'PRODUCT_DETAILS', 'PRODUCT_OFFERS', 'IMAGE_SEARCH', 'PRODUCT_REVIEWS', 'CURRENT_PRICE', 'PRICE_HISTORY', 'PRICE_ALERTS', 'PRICE_MONITORING', 'PRICE_COMPARISON', 'PRICE_VERIFICATION', 'PRICE_DROPS', 'VISION_ANALYSIS', 'OCR', 'BARCODE_SCAN');

-- Create UserAIProvider table
CREATE TABLE "user_ai_providers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
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

    CONSTRAINT "user_ai_providers_pkey" PRIMARY KEY ("id")
);

-- Create UserShoppingProvider table
CREATE TABLE "user_shopping_providers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
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

    CONSTRAINT "user_shopping_providers_pkey" PRIMARY KEY ("id")
);

-- Create UserPriceProvider table
CREATE TABLE "user_price_providers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
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

    CONSTRAINT "user_price_providers_pkey" PRIMARY KEY ("id")
);

-- Create UserVisionProvider table
CREATE TABLE "user_vision_providers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
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

    CONSTRAINT "user_vision_providers_pkey" PRIMARY KEY ("id")
);

-- Create ProviderUsage table
CREATE TABLE "provider_usage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "providerId" TEXT NOT NULL,
    "usageType" "ProviderUsageType" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "responseTime" INTEGER,
    "tokensUsed" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "creditsUsed" DECIMAL(10,4),
    "estimatedCost" DECIMAL(10,4),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "provider_usage_pkey" PRIMARY KEY ("id")
);

-- Create ProviderHealthMetrics table
CREATE TABLE "provider_health_metrics" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "ProviderStatus" NOT NULL,
    "averageResponseTime" INTEGER NOT NULL,
    "successRate" DECIMAL(5,2) NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "failedRequests" INTEGER NOT NULL,
    "rateLimitStatus" JSONB,
    "lastSuccessTime" TIMESTAMP(3),
    "lastErrorTime" TIMESTAMP(3),
    "lastError" TEXT,
    "additionalMetrics" JSONB,
    "metricsDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_health_metrics_pkey" PRIMARY KEY ("id")
);

-- Create ProviderPriceAlert table
CREATE TABLE "provider_price_alerts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "productIdentifier" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notifications" JSONB NOT NULL,
    "lastTriggered" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "priceProviderId" TEXT,

    CONSTRAINT "provider_price_alerts_pkey" PRIMARY KEY ("id")
);

-- Create ProviderRegistry table
CREATE TABLE "provider_registry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProviderCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "homepage" TEXT,
    "documentation" TEXT,
    "configSchema" JSONB NOT NULL,
    "defaultConfig" JSONB,
    "limitations" JSONB,
    "pricing" JSONB,
    "features" JSONB NOT NULL,
    "metadata" JSONB,
    "minVersion" TEXT,
    "version" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "provider_registry_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "user_ai_providers" ADD CONSTRAINT "user_ai_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_shopping_providers" ADD CONSTRAINT "user_shopping_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_price_providers" ADD CONSTRAINT "user_price_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_vision_providers" ADD CONSTRAINT "user_vision_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_price_alerts" ADD CONSTRAINT "provider_price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique constraints
ALTER TABLE "user_ai_providers" ADD CONSTRAINT "user_ai_providers_userId_providerId_key" UNIQUE ("userId", "providerId");
ALTER TABLE "user_shopping_providers" ADD CONSTRAINT "user_shopping_providers_userId_providerId_key" UNIQUE ("userId", "providerId");
ALTER TABLE "user_price_providers" ADD CONSTRAINT "user_price_providers_userId_providerId_key" UNIQUE ("userId", "providerId");
ALTER TABLE "user_vision_providers" ADD CONSTRAINT "user_vision_providers_userId_providerId_key" UNIQUE ("userId", "providerId");
ALTER TABLE "provider_health_metrics" ADD CONSTRAINT "provider_health_metrics_providerId_metricsDate_key" UNIQUE ("providerId", "metricsDate");
ALTER TABLE "provider_registry" ADD CONSTRAINT "provider_registry_providerId_key" UNIQUE ("providerId");

-- Create indexes
CREATE INDEX "user_ai_providers_userId_idx" ON "user_ai_providers"("userId");
CREATE INDEX "user_ai_providers_userId_enabled_idx" ON "user_ai_providers"("userId", "enabled");
CREATE INDEX "user_ai_providers_userId_priority_idx" ON "user_ai_providers"("userId", "priority");
CREATE INDEX "user_ai_providers_providerId_idx" ON "user_ai_providers"("providerId");

CREATE INDEX "user_shopping_providers_userId_idx" ON "user_shopping_providers"("userId");
CREATE INDEX "user_shopping_providers_userId_enabled_idx" ON "user_shopping_providers"("userId", "enabled");
CREATE INDEX "user_shopping_providers_userId_priority_idx" ON "user_shopping_providers"("userId", "priority");
CREATE INDEX "user_shopping_providers_providerId_idx" ON "user_shopping_providers"("providerId");

CREATE INDEX "user_price_providers_userId_idx" ON "user_price_providers"("userId");
CREATE INDEX "user_price_providers_userId_enabled_idx" ON "user_price_providers"("userId", "enabled");
CREATE INDEX "user_price_providers_userId_priority_idx" ON "user_price_providers"("userId", "priority");
CREATE INDEX "user_price_providers_providerId_idx" ON "user_price_providers"("providerId");

CREATE INDEX "user_vision_providers_userId_idx" ON "user_vision_providers"("userId");
CREATE INDEX "user_vision_providers_userId_enabled_idx" ON "user_vision_providers"("userId", "enabled");
CREATE INDEX "user_vision_providers_userId_priority_idx" ON "user_vision_providers"("userId", "priority");
CREATE INDEX "user_vision_providers_providerId_idx" ON "user_vision_providers"("providerId");

CREATE INDEX "provider_usage_userId_idx" ON "provider_usage"("userId");
CREATE INDEX "provider_usage_userId_createdAt_idx" ON "provider_usage"("userId", "createdAt");
CREATE INDEX "provider_usage_providerId_idx" ON "provider_usage"("providerId");
CREATE INDEX "provider_usage_category_idx" ON "provider_usage"("category");
CREATE INDEX "provider_usage_usageType_idx" ON "provider_usage"("usageType");
CREATE INDEX "provider_usage_createdAt_idx" ON "provider_usage"("createdAt");
CREATE INDEX "provider_usage_success_idx" ON "provider_usage"("success");

CREATE INDEX "provider_health_metrics_providerId_idx" ON "provider_health_metrics"("providerId");
CREATE INDEX "provider_health_metrics_category_idx" ON "provider_health_metrics"("category");
CREATE INDEX "provider_health_metrics_status_idx" ON "provider_health_metrics"("status");
CREATE INDEX "provider_health_metrics_metricsDate_idx" ON "provider_health_metrics"("metricsDate");

CREATE INDEX "provider_price_alerts_userId_idx" ON "provider_price_alerts"("userId");
CREATE INDEX "provider_price_alerts_userId_status_idx" ON "provider_price_alerts"("userId", "status");
CREATE INDEX "provider_price_alerts_productIdentifier_idx" ON "provider_price_alerts"("productIdentifier");
CREATE INDEX "provider_price_alerts_status_idx" ON "provider_price_alerts"("status");

CREATE INDEX "provider_registry_category_idx" ON "provider_registry"("category");
CREATE INDEX "provider_registry_enabled_idx" ON "provider_registry"("enabled");