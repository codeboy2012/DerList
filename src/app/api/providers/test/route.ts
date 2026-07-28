/**
 * POST /api/providers/test — Dry-run test a provider configuration (without saving).
 *
 * Makes a real API call to verify connectivity, authentication, and measure latency.
 * Returns detailed results including model count, quota, response time.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getIntegrationEntry } from '@/lib/providers/registry/integration-catalog';
import { testProviderConnection, validateProviderConfig } from '@/lib/services/integration-service';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { providerId?: string; config?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { providerId, config } = body;
  if (!providerId || !config) {
    return NextResponse.json({ error: 'providerId and config are required.' }, { status: 400 });
  }

  // Look up catalog entry
  const entry = getIntegrationEntry(providerId);

  // Validate config if entry exists
  if (entry) {
    const errors = validateProviderConfig(entry, config);
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }
  }

  // Run real test
  try {
    if (entry) {
      const result = await testProviderConnection(entry, config);
      return NextResponse.json(result);
    }

    // Generic test for unknown providers
    const baseUrl = config.baseUrl;
    if (baseUrl) {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch(baseUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'DerList/1.0' },
        });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;

        if (res.ok || res.status === 401 || res.status === 403 || res.status === 405) {
          return NextResponse.json({
            success: true,
            message: `Endpoint reachable (HTTP ${res.status})`,
            latencyMs,
            details: { httpStatus: res.status },
          });
        }

        return NextResponse.json({
          success: false,
          message: `HTTP ${res.status}`,
          latencyMs,
          error: { httpStatus: res.status },
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;
        return NextResponse.json({
          success: false,
          message: fetchErr instanceof Error ? fetchErr.message : 'Connection failed',
          latencyMs,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration accepted (no endpoint to verify)',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Test failed.' },
      { status: 500 }
    );
  }
}
