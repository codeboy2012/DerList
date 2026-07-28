/**
 * Integration Service
 *
 * Enhanced provider management service that works with the unified Integration Catalog.
 * Extends the existing ProviderSettingsService with:
 * - Catalog-driven validation (fields defined once, validated everywhere)
 * - Real test connection with provider-specific logic
 * - Health monitoring with detailed state
 * - Usage analytics with time-series data
 * - Custom API provider generation
 *
 * This does NOT replace ProviderSettingsService — it wraps and extends it.
 */

import type { ProviderCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getIntegrationEntry,
  INTEGRATION_CATALOG,
} from '@/lib/providers/registry/integration-catalog';
import {
  CATEGORY_TO_DB,
  DB_TO_CATEGORY,
  type ConfigField,
  type HealthState,
  type IntegrationCatalogEntry,
  type IntegrationCategory,
  type ProviderAnalytics,
  type ProviderCapability,
  type TestConnectionResult,
} from '@/lib/providers/registry/integration-types';
import { ProviderRepository, type ProviderConfig } from '@/lib/repositories';

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate provider config against catalog definition.
 * Returns empty array if valid.
 */
export function validateProviderConfig(
  entry: IntegrationCatalogEntry,
  config: Record<string, string>,
  existingNames?: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check required fields
  for (const field of entry.requiredConfig) {
    const value = config[field.key];
    if (!value || !value.trim()) {
      errors.push({ field: field.key, message: `${field.label} is required` });
      continue;
    }
    validateField(field, value, errors);
  }

  // Check optional fields that have values
  for (const field of entry.optionalConfig ?? []) {
    const value = config[field.key];
    if (value && value.trim()) {
      validateField(field, value, errors);
    }
  }

  // Duplicate name check
  if (existingNames && config._name) {
    const lowerName = config._name.toLowerCase().trim();
    if (existingNames.some((n) => n.toLowerCase() === lowerName)) {
      errors.push({ field: '_name', message: 'An integration with this name already exists' });
    }
  }

  return errors;
}

function validateField(field: ConfigField, value: string, errors: ValidationError[]) {
  // Pattern validation
  if (field.pattern) {
    const regex = new RegExp(field.pattern);
    if (!regex.test(value)) {
      errors.push({
        field: field.key,
        message: field.patternMessage || `Invalid format for ${field.label}`,
      });
    }
  }

  // URL validation
  if (field.type === 'url' && value) {
    try {
      new URL(value);
    } catch {
      errors.push({ field: field.key, message: `${field.label} must be a valid URL` });
    }
  }

  // Number validation
  if (field.type === 'number' && value) {
    const num = Number(value);
    if (isNaN(num)) {
      errors.push({ field: field.key, message: `${field.label} must be a number` });
    } else {
      if (field.min !== undefined && num < field.min) {
        errors.push({ field: field.key, message: `${field.label} must be at least ${field.min}` });
      }
      if (field.max !== undefined && num > field.max) {
        errors.push({ field: field.key, message: `${field.label} must be at most ${field.max}` });
      }
    }
  }

  // Min/max length for text
  if ((field.type === 'text' || field.type === 'password') && value) {
    if (field.min !== undefined && value.length < field.min) {
      errors.push({
        field: field.key,
        message: `${field.label} must be at least ${field.min} characters`,
      });
    }
    if (field.max !== undefined && value.length > field.max) {
      errors.push({
        field: field.key,
        message: `${field.label} must be at most ${field.max} characters`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Connection — Provider-specific implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test a provider's connectivity by making a real API call.
 * Returns detailed results including latency, model count, quota info.
 */
export async function testProviderConnection(
  entry: IntegrationCatalogEntry,
  config: Record<string, unknown>
): Promise<TestConnectionResult> {
  const start = Date.now();

  try {
    switch (entry.id) {
      case 'openai':
        return await testOpenAI(config, start);
      case 'openrouter':
        return await testOpenRouter(config, start);
      case 'anthropic':
        return await testAnthropic(config, start);
      case 'google':
        return await testGemini(config, start);
      case 'groq':
        return await testGroq(config, start);
      case 'brave':
        return await testBraveSearch(config, start);
      case 'serpapi':
      case 'serpapi-shopping':
        return await testSerpAPI(config, start);
      case 'tavily':
        return await testTavily(config, start);
      case 'keepa':
        return await testKeepa(config, start);
      default:
        return await testGenericEndpoint(entry, config, start);
    }
  } catch (error) {
    const latencyMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : 'Connection failed';
    return {
      success: false,
      message: classifyError(msg),
      latencyMs,
      error: { suggestion: getSuggestion(msg) },
    };
  }
}

async function testOpenAI(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const baseUrl = (config.baseUrl as string) || 'https://api.openai.com/v1';
  const apiKey = config.apiKey as string;

  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      success: false,
      message: `Authentication failed (HTTP ${res.status})`,
      latencyMs,
      error: {
        httpStatus: res.status,
        suggestion: res.status === 401 ? 'Check your API key' : body.slice(0, 100),
      },
    };
  }

  const data = await res.json();
  const modelCount = Array.isArray(data.data) ? data.data.length : 0;

  return {
    success: true,
    message: 'Connected',
    latencyMs,
    details: { modelCount, quota: 'Active' },
  };
}

async function testOpenRouter(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;
  const baseUrl = (config.baseUrl as string) || 'https://openrouter.ai/api/v1';

  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latencyMs,
      error: { httpStatus: res.status, suggestion: 'Verify your OpenRouter API key' },
    };
  }

  const data = await res.json();
  const modelCount = Array.isArray(data.data) ? data.data.length : 0;

  return {
    success: true,
    message: 'Connected',
    latencyMs,
    details: { modelCount, quota: 'Unlimited' },
  };
}

async function testAnthropic(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;

  // Anthropic doesn't have a /models endpoint — send a minimal message
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  const latencyMs = Date.now() - start;

  if (res.status === 401 || res.status === 403) {
    return {
      success: false,
      message: 'Invalid API Key',
      latencyMs,
      error: {
        httpStatus: res.status,
        suggestion: 'Check your Anthropic API key starts with sk-ant-',
      },
    };
  }

  // Any non-auth error means auth worked
  return { success: true, message: 'Connected', latencyMs, details: { quota: 'Active' } };
}

async function testGemini(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    signal: AbortSignal.timeout(15000),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latencyMs,
      error: { httpStatus: res.status },
    };
  }

  const data = await res.json();
  const modelCount = Array.isArray(data.models) ? data.models.length : 0;

  return { success: true, message: 'Connected', latencyMs, details: { modelCount } };
}

async function testGroq(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latencyMs,
      error: { httpStatus: res.status },
    };
  }

  const data = await res.json();
  const modelCount = Array.isArray(data.data) ? data.data.length : 0;

  return {
    success: true,
    message: 'Connected',
    latencyMs,
    details: { modelCount, quota: 'Active' },
  };
}

async function testBraveSearch(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;
  const res = await fetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const latencyMs = Date.now() - start;

  if (res.status === 401 || res.status === 403) {
    return {
      success: false,
      message: 'Invalid API Key',
      latencyMs,
      error: { httpStatus: res.status },
    };
  }
  if (!res.ok) {
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latencyMs,
      error: { httpStatus: res.status },
    };
  }

  return { success: true, message: 'Connected', latencyMs, details: { quota: 'Active' } };
}

async function testSerpAPI(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;
  const res = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`, {
    signal: AbortSignal.timeout(15000),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latencyMs,
      error: { httpStatus: res.status },
    };
  }

  const data = await res.json();
  return {
    success: true,
    message: 'Connected',
    latencyMs,
    details: {
      plan: data.plan_name || 'Unknown',
      rateLimitRemaining: data.searches_per_month
        ? data.searches_per_month -
          (data.total_searches_left != null
            ? data.searches_per_month - data.total_searches_left
            : 0)
        : undefined,
    },
  };
}

async function testTavily(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query: 'test', max_results: 1 }),
    signal: AbortSignal.timeout(15000),
  });
  const latencyMs = Date.now() - start;

  if (res.status === 401 || res.status === 403) {
    return {
      success: false,
      message: 'Invalid API Key',
      latencyMs,
      error: { httpStatus: res.status },
    };
  }
  if (!res.ok) {
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latencyMs,
      error: { httpStatus: res.status },
    };
  }

  return { success: true, message: 'Connected', latencyMs, details: { quota: 'Active' } };
}

async function testKeepa(
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const apiKey = config.apiKey as string;
  const res = await fetch(`https://api.keepa.com/token?key=${apiKey}`, {
    signal: AbortSignal.timeout(15000),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    return {
      success: false,
      message: `HTTP ${res.status}`,
      latencyMs,
      error: { httpStatus: res.status },
    };
  }

  const data = await res.json();
  return {
    success: true,
    message: 'Connected',
    latencyMs,
    details: { rateLimitRemaining: data.tokensLeft },
  };
}

async function testGenericEndpoint(
  entry: IntegrationCatalogEntry,
  config: Record<string, unknown>,
  start: number
): Promise<TestConnectionResult> {
  const baseUrl = (config.baseUrl as string) || entry.website;
  if (!baseUrl) {
    return { success: false, message: 'No endpoint to test', latencyMs: 0 };
  }

  const testUrl = entry.testConnection?.endpoint
    ? `${baseUrl}${entry.testConnection.endpoint}`
    : baseUrl;

  const method = entry.testConnection?.method || 'HEAD';
  const headers: Record<string, string> = { 'User-Agent': 'DerList/1.0' };

  // Apply auth if we have an API key
  const apiKey = config.apiKey as string | undefined;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(testUrl, { method, headers, signal: AbortSignal.timeout(15000) });
  const latencyMs = Date.now() - start;

  const successCodes = entry.testConnection?.successCodes || [
    200, 201, 204, 301, 302, 401, 403, 405,
  ];

  if (successCodes.includes(res.status) || res.ok) {
    return {
      success: true,
      message: 'Endpoint reachable',
      latencyMs,
      details: { httpStatus: res.status },
    };
  }

  return {
    success: false,
    message: `HTTP ${res.status}`,
    latencyMs,
    error: { httpStatus: res.status },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────────────────────────────────────

function classifyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key'))
    return 'Authentication failed — Invalid API Key';
  if (lower.includes('403') || lower.includes('forbidden'))
    return 'Access denied — Check permissions';
  if (lower.includes('429') || lower.includes('rate limit'))
    return 'Rate limited — Try again later';
  if (lower.includes('timeout') || lower.includes('aborted')) return 'Connection timed out';
  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed')
  )
    return 'Cannot reach provider — Check URL or network';
  if (lower.includes('500') || lower.includes('502') || lower.includes('503'))
    return 'Provider service error';
  return msg.length > 120 ? msg.slice(0, 120) + '...' : msg;
}

function getSuggestion(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('401') || lower.includes('api key'))
    return 'Double-check your API key is correct and not expired';
  if (lower.includes('econnrefused')) return 'If self-hosted, ensure the service is running';
  if (lower.includes('timeout')) return 'The provider may be slow — try increasing the timeout';
  return 'Check the provider documentation for troubleshooting';
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Monitoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run health check on a single provider and update its status.
 */
export async function checkProviderHealth(providerConfig: ProviderConfig): Promise<HealthState> {
  const entry = getIntegrationEntry(providerConfig.providerId);
  if (!entry) return 'offline';

  try {
    const result = await testProviderConnection(
      entry,
      providerConfig.config as Record<string, unknown>
    );

    let state: HealthState;
    if (!result.success) {
      state = 'offline';
    } else if (result.latencyMs && result.latencyMs > 5000) {
      state = 'slow';
    } else if (result.latencyMs && result.latencyMs > 2000) {
      state = 'warning';
    } else {
      state = 'healthy';
    }

    // Update DB
    const dbStatus = state === 'healthy' ? 'HEALTHY' : state === 'slow' ? 'DEGRADED' : 'UNHEALTHY';
    await prisma.providerConfiguration.update({
      where: { id: providerConfig.id },
      data: {
        lastHealthCheck: new Date(),
        lastStatus: dbStatus as 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY',
        ...(result.success
          ? { lastSuccessAt: new Date(), lastError: null }
          : { lastErrorAt: new Date(), lastError: result.message }),
      },
    });

    return state;
  } catch (error) {
    await prisma.providerConfiguration.update({
      where: { id: providerConfig.id },
      data: {
        lastHealthCheck: new Date(),
        lastStatus: 'UNHEALTHY',
        lastErrorAt: new Date(),
        lastError: error instanceof Error ? error.message : 'Health check failed',
      },
    });
    return 'offline';
  }
}

/**
 * Run health checks on all providers for a user.
 */
export async function checkAllProviderHealth(userId: string): Promise<Record<string, HealthState>> {
  const configs = await ProviderRepository.listAll(userId);
  const results: Record<string, HealthState> = {};

  // Run in parallel with concurrency limit of 5
  const chunks = [];
  for (let i = 0; i < configs.length; i += 5) {
    chunks.push(configs.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (config) => {
        const state = await checkProviderHealth(config);
        return { id: config.id, state };
      })
    );
    for (const { id, state } of chunkResults) {
      results[id] = state;
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get detailed analytics for a specific provider.
 */
export async function getProviderAnalytics(
  userId: string,
  providerConfigId: string,
  days = 30
): Promise<ProviderAnalytics | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const config = await prisma.providerConfiguration.findFirst({
    where: { id: providerConfigId, userId },
  });
  if (!config) return null;

  // Get usage records
  const usageRecords = await prisma.providerUsage.findMany({
    where: { providerConfigId, userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
  });

  const totalRequests = usageRecords.length;
  const successfulRequests = usageRecords.filter((r) => r.success).length;
  const todayRequests = usageRecords.filter((r) => r.createdAt >= todayStart).length;
  const errors = usageRecords.filter((r) => !r.success);
  const latencies = usageRecords.filter((r) => r.responseTime != null).map((r) => r.responseTime!);
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const totalCost = usageRecords.reduce((sum, r) => sum + Number(r.estimatedCost ?? 0), 0);
  const lastError = errors.length > 0 ? errors[errors.length - 1] : null;

  // Build daily request chart data
  const dailyMap = new Map<string, { count: number; errors: number }>();
  for (const record of usageRecords) {
    const dateKey = record.createdAt.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || { count: 0, errors: 0 };
    existing.count++;
    if (!record.success) existing.errors++;
    dailyMap.set(dateKey, existing);
  }
  const dailyRequests = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    count: data.count,
    errors: data.errors,
  }));

  // Build latency history
  const latencyMap = new Map<string, number[]>();
  for (const record of usageRecords) {
    if (record.responseTime == null) continue;
    const dateKey = record.createdAt.toISOString().split('T')[0];
    const existing = latencyMap.get(dateKey) || [];
    existing.push(record.responseTime);
    latencyMap.set(dateKey, existing);
  }
  const latencyHistory = Array.from(latencyMap.entries()).map(([date, values]) => ({
    date,
    avgMs: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  }));

  return {
    providerId: providerConfigId,
    status: (config.lastStatus?.toLowerCase() ?? 'unknown') as ProviderAnalytics['status'],
    latencyMs: avgLatency,
    lastHealthCheck: config.lastHealthCheck?.toISOString() ?? null,
    requestsToday: todayRequests,
    requestsMonth: totalRequests,
    remainingCredits: null,
    estimatedCost: totalCost > 0 ? totalCost : null,
    errorCount: errors.length,
    lastError: lastError?.errorMessage ?? null,
    successRate: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100,
    avgResponseTime: avgLatency,
    uptimePercent: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100,
    lastSuccessfulRequest: config.lastSuccessAt?.toISOString() ?? null,
    dailyRequests,
    latencyHistory,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration CRUD (extends existing repository)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateIntegrationInput {
  userId: string;
  providerId: string;
  name: string;
  config: Record<string, string>;
  enabled?: boolean;
  priority?: number;
  mode?: 'hosted' | 'personal';
  timeout?: number;
  rateLimit?: number;
  retries?: number;
}

/**
 * Create a new provider integration with full validation.
 * Uses the catalog to validate fields and maps to the correct DB category.
 */
export async function createIntegration(input: CreateIntegrationInput): Promise<ProviderConfig> {
  // Look up in catalog (support both new and custom providers)
  const entry = getIntegrationEntry(input.providerId);

  // Determine DB category
  let dbCategory: ProviderCategory;
  if (entry) {
    dbCategory = CATEGORY_TO_DB[entry.category] as ProviderCategory;

    // Validate config
    const existingConfigs = await ProviderRepository.listAll(input.userId);
    const existingNames = existingConfigs.map((c) => c.name);
    const errors = validateProviderConfig(
      entry,
      { ...input.config, _name: input.name },
      existingNames
    );
    if (errors.length > 0) {
      throw new Error(errors.map((e) => e.message).join('; '));
    }
  } else {
    // Custom provider — default to SHOPPING_SEARCH
    dbCategory = 'SHOPPING_SEARCH';
  }

  // Store mode and advanced settings in the config
  const configToStore: Record<string, unknown> = { ...input.config };
  if (input.mode) configToStore._mode = input.mode;

  return ProviderRepository.create({
    userId: input.userId,
    category: dbCategory,
    providerId: input.providerId,
    name: input.name,
    config: configToStore,
    enabled: input.enabled ?? true,
    priority: input.priority ?? 10,
  });
}

/**
 * Update an existing integration's config. Secrets are re-encrypted.
 */
export async function updateIntegration(
  id: string,
  userId: string,
  updates: {
    name?: string;
    config?: Record<string, string>;
    enabled?: boolean;
    priority?: number;
    mode?: 'hosted' | 'personal';
  }
): Promise<ProviderConfig> {
  const existing = await ProviderRepository.findById(id, userId);
  if (!existing) throw new Error('Integration not found');

  const updateInput: {
    name?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
    priority?: number;
  } = {};

  if (updates.name) updateInput.name = updates.name;
  if (updates.enabled !== undefined) updateInput.enabled = updates.enabled;
  if (updates.priority !== undefined) updateInput.priority = updates.priority;

  if (updates.config) {
    // Merge with existing config (don't lose fields not being updated)
    const merged = { ...(existing.config as Record<string, unknown>) };
    for (const [key, value] of Object.entries(updates.config)) {
      if (value !== undefined && value !== '') {
        merged[key] = value;
      }
    }
    if (updates.mode) merged._mode = updates.mode;
    updateInput.config = merged;
  }

  return ProviderRepository.update(id, userId, updateInput);
}

/**
 * Get capabilities for a configured provider.
 */
export function getProviderCapabilities(providerId: string): ProviderCapability[] {
  const entry = getIntegrationEntry(providerId);
  if (!entry) return [];

  // If capabilities is an array, return directly
  if (Array.isArray(entry.capabilities)) {
    return entry.capabilities;
  }

  // Convert AICapabilities object to capability array
  if (entry.capabilities) {
    const caps: ProviderCapability[] = [];
    const aiCaps = entry.capabilities as Partial<{
      chat: boolean;
      streaming: boolean;
      vision: boolean;
      functionCalling: boolean;
      jsonMode: boolean;
      embeddings: boolean;
    }>;
    if (aiCaps.chat) caps.push('chat');
    if (aiCaps.streaming) caps.push('streaming');
    if (aiCaps.vision) caps.push('vision');
    if (aiCaps.functionCalling) caps.push('functionCalling');
    if (aiCaps.embeddings) caps.push('embeddings');
    return caps;
  }

  // Infer from category
  switch (entry.category) {
    case 'search':
      return ['search'];
    case 'shopping':
      return ['search', 'shopping'];
    case 'price':
      return ['priceTracking', 'priceHistory'];
    case 'media':
      return ['images'];
    case 'automation':
      return ['automation', 'webhook'];
    default:
      return [];
  }
}
