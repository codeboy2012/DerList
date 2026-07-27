/**
 * Provider Metrics — In-memory request tracking and performance monitoring.
 *
 * Tracks per-provider: request count, latency, errors, and circuit state.
 * Can be exported to external monitoring systems later.
 */

import { getCircuitState } from './circuit-breaker';
import type { ProviderMetrics } from './types';

interface MetricEntry {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[]; // Last 100 latencies for percentile calculation
  lastRequestAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
}

const metrics = new Map<string, MetricEntry>();
const MAX_LATENCY_SAMPLES = 100;

function getEntry(providerId: string): MetricEntry {
  if (!metrics.has(providerId)) {
    metrics.set(providerId, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      latencies: [],
      lastRequestAt: null,
      lastErrorAt: null,
      lastError: null,
    });
  }
  return metrics.get(providerId)!;
}

/**
 * Record a successful request with latency.
 */
export function recordRequestSuccess(providerId: string, latencyMs: number): void {
  const entry = getEntry(providerId);
  entry.totalRequests++;
  entry.successfulRequests++;
  entry.lastRequestAt = Date.now();
  entry.latencies.push(latencyMs);
  if (entry.latencies.length > MAX_LATENCY_SAMPLES) {
    entry.latencies.shift();
  }
}

/**
 * Record a failed request.
 */
export function recordRequestFailure(providerId: string, error: string): void {
  const entry = getEntry(providerId);
  entry.totalRequests++;
  entry.failedRequests++;
  entry.lastRequestAt = Date.now();
  entry.lastErrorAt = Date.now();
  entry.lastError = error;
}

/**
 * Get metrics for a specific provider.
 */
export function getProviderMetrics(providerId: string): ProviderMetrics {
  const entry = getEntry(providerId);
  const latencies = entry.latencies;

  const averageLatency =
    latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  const sorted = [...latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p95Latency = sorted[p95Index] ?? 0;

  return {
    providerId,
    totalRequests: entry.totalRequests,
    successfulRequests: entry.successfulRequests,
    failedRequests: entry.failedRequests,
    averageLatencyMs: Math.round(averageLatency),
    p95LatencyMs: Math.round(p95Latency),
    lastRequestAt: entry.lastRequestAt ? new Date(entry.lastRequestAt) : null,
    lastErrorAt: entry.lastErrorAt ? new Date(entry.lastErrorAt) : null,
    lastError: entry.lastError,
    circuitState: getCircuitState(providerId),
  };
}

/**
 * Get metrics for all tracked providers.
 */
export function getAllMetrics(): ProviderMetrics[] {
  return [...metrics.keys()].map(getProviderMetrics);
}

/**
 * Reset all metrics (e.g., for testing).
 */
export function resetMetrics(): void {
  metrics.clear();
}
