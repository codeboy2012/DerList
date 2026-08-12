/**
 * GET/PUT /api/settings/ai-permissions
 *
 * Manage AI assistant wishlist permissions.
 * Stored in the user's aiProviderConfig JSON field.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_PERMISSIONS = [
  'wishlist.read',
  'wishlist.add',
  'wishlist.remove',
  'wishlist.update',
  'wishlist.reorder',
  'wishlist.clear',
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });

  const config = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};
  const permissions = (config.assistantPermissions as Record<string, boolean>) ?? {};

  return NextResponse.json({ success: true, permissions });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { permissions?: Record<string, boolean> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.permissions || typeof body.permissions !== 'object') {
    return NextResponse.json({ error: 'permissions object required' }, { status: 400 });
  }

  // Only accept valid permission keys with boolean values
  const cleaned: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(body.permissions)) {
    if (VALID_PERMISSIONS.includes(key) && typeof value === 'boolean') {
      cleaned[key] = value;
    }
  }

  // Read existing config, merge permissions
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });

  const existing = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};

  await prisma.user.update({
    where: { id: user.id },
    data: {
      aiProviderConfig: { ...existing, assistantPermissions: cleaned },
    },
  });

  return NextResponse.json({ success: true, permissions: cleaned });
}
