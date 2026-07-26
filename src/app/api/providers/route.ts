/**
 * POST /api/providers — Add a new provider configuration.
 * GET  /api/providers — List user's provider configurations.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServices } from '@/lib/services/create';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { providerSettings } = createServices();
  const providers = await providerSettings.getUserProviders(user.id);

  // Strip sensitive config from response
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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { providerId, category, name, config } = body;

  if (!providerId || !category || !config) {
    return NextResponse.json(
      { error: 'providerId, category, and config are required.' },
      { status: 400 }
    );
  }

  try {
    const { providerSettings } = createServices();
    const provider = await providerSettings.addProvider({
      userId: user.id,
      providerId,
      category: category as 'AI' | 'SHOPPING_SEARCH' | 'PRICE' | 'VISION',
      name: name || providerId,
      config,
    });

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
