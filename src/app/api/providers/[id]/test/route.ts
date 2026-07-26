/**
 * POST /api/providers/[id]/test — Test a provider configuration.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServices } from '@/lib/services/create';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const { providerSettings } = createServices();
    const result = await providerSettings.testProvider(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Test failed.' },
      { status: 500 }
    );
  }
}
