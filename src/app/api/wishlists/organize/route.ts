/**
 * POST /api/wishlists/organize
 *
 * AI Organizer: analyzes a wishlist and suggests/applies bulk improvements.
 * Two modes:
 * - analyze: returns what changes would be made (preview)
 * - apply: actually applies the changes
 */

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProviderManager } from '@/lib/providers';
import type { Message } from '@/lib/providers/types';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { wishlistId?: string; mode?: 'analyze' | 'apply' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { wishlistId, mode } = body;
  if (!wishlistId || !mode) {
    return NextResponse.json({ error: 'wishlistId and mode are required' }, { status: 400 });
  }

  // Verify ownership
  const wishlist = await prisma.wishlist.findFirst({
    where: { id: wishlistId, ownerId: user.id },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  if (!wishlist) return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });

  if (wishlist.items.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 items to organize' }, { status: 400 });
  }

  const providers = getProviderManager();
  const aiProvider = await providers.getAIProvider(user.id);
  if (!aiProvider) {
    return NextResponse.json(
      { error: 'No AI provider configured. Add one in Settings → Providers.' },
      { status: 400 }
    );
  }

  // Build item list for AI
  const itemList = wishlist.items
    .map((item, i) => {
      const parts = [`${i}. "${item.title}"`];
      if (item.brand) parts.push(`brand:${item.brand}`);
      if (item.category) parts.push(`cat:${item.category}`);
      if (item.retailer) parts.push(`from:${item.retailer}`);
      if (item.currentPrice) parts.push(`$${item.currentPrice}`);
      return parts.join(' ');
    })
    .join('\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `You are a wishlist organizer. Analyze products and suggest improvements.

Return ONLY JSON:
{
  "duplicates": number of duplicate/very similar items detected,
  "titlesImproved": number of titles that could be cleaner,
  "descriptionsCleaned": number of descriptions to clean,
  "categoriesCreated": number of new categories to create,
  "foldersCreated": number of logical groupings found,
  "itemsReorganized": number of items to move into categories,
  "detailsAdded": number of items missing basic info,
  "suggestions": ["brief description of each key change"],
  "changes": [
    {"index": 0, "action": "rename", "newTitle": "Cleaned title"},
    {"index": 1, "action": "categorize", "category": "Category Name"},
    {"index": 2, "action": "duplicate", "duplicateOf": 3}
  ]
}

Rules:
- Remove promotional text (FREE SHIPPING, LIMITED TIME, etc.) from titles
- Normalize brand names (e.g. "apple" → "Apple")
- Detect duplicates by matching similar product names
- Group related items into categories
- Only suggest changes that genuinely improve organization
- Keep changes conservative — don't rename things unnecessarily
- Maximum 50 changes in the array`,
    },
    {
      role: 'user',
      content: `Analyze this wishlist (${wishlist.items.length} items):\n\n${itemList}`,
    },
  ];

  try {
    const response = await aiProvider.chat(messages, {
      maxTokens: 2000,
      temperature: 0.2,
      json: true,
    });

    let parsed;
    try {
      let jsonStr = response.content.trim();
      if (jsonStr.startsWith('```'))
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { success: false, error: 'AI returned invalid response' },
        { status: 500 }
      );
    }

    if (mode === 'analyze') {
      return NextResponse.json({
        success: true,
        analysis: {
          duplicates: parsed.duplicates || 0,
          titlesImproved: parsed.titlesImproved || 0,
          descriptionsCleaned: parsed.descriptionsCleaned || 0,
          categoriesCreated: parsed.categoriesCreated || 0,
          foldersCreated: parsed.foldersCreated || 0,
          itemsReorganized: parsed.itemsReorganized || 0,
          detailsAdded: parsed.detailsAdded || 0,
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        },
      });
    }

    // mode === 'apply' — apply changes
    const changes = Array.isArray(parsed.changes) ? parsed.changes : [];
    let applied = 0;

    for (const change of changes) {
      const idx = change.index;
      if (typeof idx !== 'number' || idx < 0 || idx >= wishlist.items.length) continue;
      const item = wishlist.items[idx];

      try {
        if (change.action === 'rename' && change.newTitle) {
          await prisma.wishlistItem.update({
            where: { id: item.id },
            data: { title: String(change.newTitle).trim() },
          });
          applied++;
        } else if (change.action === 'categorize' && change.category) {
          await prisma.wishlistItem.update({
            where: { id: item.id },
            data: { category: String(change.category) },
          });
          applied++;
        } else if (change.action === 'duplicate' && typeof change.duplicateOf === 'number') {
          // Mark as purchased (soft-remove duplicate)
          await prisma.wishlistItem.update({
            where: { id: item.id },
            data: {
              notes: `[Duplicate of item #${change.duplicateOf + 1}] ${item.notes || ''}`.trim(),
            },
          });
          applied++;
        }
      } catch {
        // Skip individual failures
      }
    }

    revalidatePath(`/wishlists/${wishlistId}`);
    revalidatePath('/dashboard');

    return NextResponse.json({ success: true, applied });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Organization failed',
      },
      { status: 500 }
    );
  }
}
