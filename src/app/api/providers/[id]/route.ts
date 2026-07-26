/**
 * DELETE /api/providers/[id] — Delete a provider configuration.
 * PATCH  /api/providers/[id] — Update a provider configuration.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServices } from '@/lib/services/create';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const { providerSettings } = createServices();
    await providerSettings.deleteProvider(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete.' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: {
    name?: string;
    enabled?: boolean;
    priority?: number;
    config?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  try {
    const { providerSettings } = createServices();
    const updated = await providerSettings.updateProvider(id, user.id, body);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { config: _config, ...safe } = updated;
    return NextResponse.json({ success: true, provider: safe });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update.' },
      { status: 400 }
    );
  }
}
