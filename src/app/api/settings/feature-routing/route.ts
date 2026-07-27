/**
 * GET/PUT /api/settings/feature-routing
 *
 * Feature Routing: allows users to choose which provider handles each feature.
 * Stored in the user's AI provider config metadata field.
 *
 * Example routing:
 * {
 *   "aiChat": "openrouter",
 *   "aiAutoFill": "openrouter",
 *   "productSearch": "brave",
 *   "priceTracking": "keepa",
 *   "imageSearch": "brave",
 *   "shoppingSearch": "serpapi"
 * }
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_ROUTING: Record<string, string> = {
  aiChat: 'openrouter',
  aiAutoFill: 'openrouter',
  aiOrganizer: 'openrouter',
  productSearch: 'brave',
  shoppingSearch: 'serpapi',
  priceTracking: 'keepa',
  imageSearch: 'brave',
  duplicateDetection: 'openrouter',
  productSummaries: 'openrouter',
  compatibility: '',
};

const VALID_FEATURES = Object.keys(DEFAULT_ROUTING);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Read from user record (stored in aiProviderConfig JSON field — repurposed)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });

  const config = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};
  const routing = (config.featureRouting as Record<string, string>) ?? {};

  return NextResponse.json({
    success: true,
    routing: { ...DEFAULT_ROUTING, ...routing },
    features: VALID_FEATURES,
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { routing?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.routing || typeof body.routing !== 'object') {
    return NextResponse.json({ error: 'routing object required' }, { status: 400 });
  }

  // Validate feature names
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.routing)) {
    if (VALID_FEATURES.includes(key) && typeof value === 'string') {
      cleaned[key] = value;
    }
  }

  // Read existing config, merge routing
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });

  const existing = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};

  await prisma.user.update({
    where: { id: user.id },
    data: {
      aiProviderConfig: { ...existing, featureRouting: cleaned },
    },
  });

  return NextResponse.json({ success: true, routing: { ...DEFAULT_ROUTING, ...cleaned } });
}
