/**
 * POST /api/providers — Add a new provider configuration.
 * GET  /api/providers — List user's provider configurations.
 *
 * POST now accepts any provider from the integration catalog,
 * validates config against the catalog definition, and persists securely.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getIntegrationEntry } from '@/lib/providers/registry/integration-catalog';
import {
  CATEGORY_TO_DB,
  type IntegrationCategory,
} from '@/lib/providers/registry/integration-types';
import { createServices } from '@/lib/services/create';
import { createIntegration } from '@/lib/services/integration-service';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { providerSettings } = createServices();
  const providers = await providerSettings.getUserProviders(user.id);

  // Strip sensitive config from response — never send secrets to client
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const safe = providers.map(({ config: _c, ...rest }) => rest);

  return NextResponse.json({ providers: safe });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    providerId?: string;
    category?: string;
    name?: string;
    config?: Record<string, string>;
    enabled?: boolean;
    priority?: number;
    mode?: 'hosted' | 'personal';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { providerId, category, name, config, enabled, priority, mode } = body;

  if (!providerId || !config) {
    return NextResponse.json({ error: 'providerId and config are required.' }, { status: 400 });
  }

  try {
    // Try new integration service first (supports full catalog)
    const catalogEntry = getIntegrationEntry(providerId);

    let provider;
    if (catalogEntry || providerId.startsWith('custom-')) {
      // Use new integration service with full validation
      provider = await createIntegration({
        userId: user.id,
        providerId,
        name: name || catalogEntry?.name || providerId,
        config,
        enabled,
        priority,
        mode,
      });
    } else {
      // Fallback to legacy service for backward compat
      const { providerSettings } = createServices();
      const dbCategory = (category || 'SHOPPING_SEARCH') as
        'AI' | 'SHOPPING_SEARCH' | 'PRICE' | 'VISION';

      provider = await providerSettings.addProvider({
        userId: user.id,
        providerId,
        category: dbCategory,
        name: name || providerId,
        config,
      });
    }

    // Return safe version (no decrypted config)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { config: _config, ...safe } = provider;

    return NextResponse.json({ success: true, provider: safe });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add provider.' },
      { status: 400 }
    );
  }
}
