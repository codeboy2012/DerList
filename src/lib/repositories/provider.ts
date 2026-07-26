/**
 * Provider Repository
 *
 * Data access layer for provider configurations and usage tracking.
 * Handles AES-256-GCM encryption/decryption of provider API keys.
 * Only place in the app that queries ProviderConfiguration and ProviderUsage.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  ProviderUsageType,
  type ProviderCategory,
  type ProviderConfiguration,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Encryption
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const key = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'PROVIDER_ENCRYPTION_KEY environment variable is required. ' +
        'Generate one with: npm run generate-encryption-key'
    );
  }

  // Support both base64 (from generate-encryption-key script) and hex formats.
  // Base64 keys contain characters outside hex range (A-Z, +, /, =).
  const isHex = /^[0-9a-fA-F]+$/.test(key);
  const buf = isHex ? Buffer.from(key, 'hex') : Buffer.from(key, 'base64');

  if (buf.length !== 32) {
    throw new Error(
      `PROVIDER_ENCRYPTION_KEY must be 32 bytes (256-bit). Got ${buf.length} bytes. ` +
        'Generate a valid key with: npm run generate-encryption-key'
    );
  }

  return buf;
}

function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  userId: string;
  category: ProviderCategory;
  providerId: string;
  name: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  /** Decrypted configuration (API keys, endpoints, etc.) */
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderConfigCreateInput {
  userId: string;
  category: ProviderCategory;
  providerId: string;
  name: string;
  config: Record<string, unknown>;
  enabled?: boolean;
  priority?: number;
  isDefault?: boolean;
}

export interface ProviderConfigUpdateInput {
  name?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
  priority?: number;
  isDefault?: boolean;
}

export interface UsageRecordInput {
  userId: string;
  category: ProviderCategory;
  providerId: string;
  providerConfigId?: string;
  usageType: string;
  success: boolean;
  responseTime?: number;
  tokensUsed?: number;
  estimatedCost?: number;
  errorCode?: string;
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

export const ProviderRepository = {
  /**
   * Get all provider configs for a user in a specific category.
   * Returns decrypted configurations ordered by priority.
   */
  async listByCategory(userId: string, category: ProviderCategory): Promise<ProviderConfig[]> {
    const configs = await prisma.providerConfiguration.findMany({
      where: { userId, category, enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return configs.map(decryptConfig);
  },

  /**
   * Get all provider configs for a user (all categories).
   */
  async listAll(userId: string): Promise<ProviderConfig[]> {
    const configs = await prisma.providerConfiguration.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { priority: 'asc' }],
    });

    return configs.map(decryptConfig);
  },

  /**
   * Get a single provider config by ID.
   */
  async findById(id: string, userId: string): Promise<ProviderConfig | null> {
    const config = await prisma.providerConfiguration.findFirst({
      where: { id, userId },
    });
    if (!config) return null;
    return decryptConfig(config);
  },

  /**
   * Get the default/highest-priority provider for a category.
   * Returns null if no providers are configured.
   */
  async getDefault(userId: string, category: ProviderCategory): Promise<ProviderConfig | null> {
    const config = await prisma.providerConfiguration.findFirst({
      where: { userId, category, enabled: true },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    });
    if (!config) return null;
    return decryptConfig(config);
  },

  /**
   * Create a new provider configuration.
   */
  async create(input: ProviderConfigCreateInput): Promise<ProviderConfig> {
    const { encrypted, iv, authTag } = encrypt(JSON.stringify(input.config));

    const config = await prisma.providerConfiguration.create({
      data: {
        userId: input.userId,
        category: input.category,
        providerId: input.providerId,
        name: input.name,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 1,
        isDefault: input.isDefault ?? false,
        encryptedConfig: encrypted,
        configIv: iv,
        configAuthTag: authTag,
      },
    });

    return decryptConfig(config);
  },

  /**
   * Update a provider configuration.
   */
  async update(
    id: string,
    userId: string,
    input: ProviderConfigUpdateInput
  ): Promise<ProviderConfig> {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

    if (input.config) {
      const { encrypted, iv, authTag } = encrypt(JSON.stringify(input.config));
      updateData.encryptedConfig = encrypted;
      updateData.configIv = iv;
      updateData.configAuthTag = authTag;
    }

    const config = await prisma.providerConfiguration.update({
      where: { id, userId },
      data: updateData,
    });

    return decryptConfig(config);
  },

  /**
   * Delete a provider configuration.
   */
  async delete(id: string, userId: string): Promise<void> {
    await prisma.providerConfiguration.delete({
      where: { id, userId },
    });
  },

  /**
   * Record a provider usage event.
   */
  async recordUsage(input: UsageRecordInput): Promise<void> {
    await prisma.providerUsage.create({
      data: {
        userId: input.userId,
        category: input.category,
        providerId: input.providerId,
        providerConfigId: input.providerConfigId ?? null,
        usageType: input.usageType as ProviderUsageType,
        success: input.success,
        responseTime: input.responseTime ?? null,
        tokensUsed: input.tokensUsed ?? null,
        estimatedCost: input.estimatedCost ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    });
  },

  /**
   * Get usage statistics for a user within a time range.
   */
  async getUsageStats(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, successful, byCategory] = await Promise.all([
      prisma.providerUsage.count({
        where: { userId, createdAt: { gte: since } },
      }),
      prisma.providerUsage.count({
        where: { userId, createdAt: { gte: since }, success: true },
      }),
      prisma.providerUsage.groupBy({
        by: ['category'],
        where: { userId, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { estimatedCost: true },
      }),
    ]);

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: total - successful,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      byCategory: byCategory.map((c: (typeof byCategory)[number]) => ({
        category: c.category,
        requests: c._count.id,
        cost: Number(c._sum.estimatedCost ?? 0),
      })),
    };
  },

  /**
   * Update provider health status after a request.
   */
  async updateHealth(id: string, success: boolean, error?: string): Promise<void> {
    await prisma.providerConfiguration.update({
      where: { id },
      data: {
        lastHealthCheck: new Date(),
        lastStatus: success ? 'HEALTHY' : 'UNHEALTHY',
        ...(success
          ? { lastSuccessAt: new Date(), lastError: null }
          : { lastErrorAt: new Date(), lastError: error ?? 'Unknown error' }),
      },
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function decryptConfig(raw: ProviderConfiguration): ProviderConfig {
  let config: Record<string, unknown> = {};
  try {
    const decrypted = decrypt(raw.encryptedConfig, raw.configIv, raw.configAuthTag);
    config = JSON.parse(decrypted);
  } catch {
    // If decryption fails (key changed, corrupted), return empty config
    config = {};
  }

  return {
    id: raw.id,
    userId: raw.userId,
    category: raw.category,
    providerId: raw.providerId,
    name: raw.name,
    enabled: raw.enabled,
    priority: raw.priority,
    isDefault: raw.isDefault,
    config,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
