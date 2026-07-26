/**
 * POST /api/wishlists/organize
 *
 * AI Organizer: analyzes a wishlist and suggests/applies bulk improvements.
 * Two modes:
 * - analyze: calls AI, returns stats + changes array for preview
 * - apply: receives the changes array from the client and executes them
 *
 * This ensures the preview and apply show/do exactly the same thing.
 */

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProviderManager } from '@/lib/providers';
import type { Message } from '@/lib/providers/types';

interface OrganizerChange {
  index: number;
  action: 'rename' | 'categorize' | 'brand' | 'duplicate' | 'priority';
  newTitle?: string;
  category?: string;
  brand?: string;
  duplicateOf?: number;
  priority?: string;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    wishlistId?: string;
    mode?: 'analyze' | 'apply';
    changes?: OrganizerChange[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { wishlistId, mode } = body;
  if (!wishlistId || !mode) {
    return NextResponse.json({ error: 'wishlistId and mode are required' }, { status: 400 });
  }

  // Verify ownership and load items
  const wishlist = await prisma.wishlist.findFirst({
    where: { id: wishlistId, ownerId: user.id },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  if (!wishlist) return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });

  if (wishlist.items.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 items to organize' }, { status: 400 });
  }

  // ─── APPLY MODE: execute provided changes ───
  if (mode === 'apply') {
    const changes = body.changes;
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ error: 'No changes to apply' }, { status: 400 });
    }

    let applied = 0;
    for (const change of changes) {
      const idx = change.index;
      if (typeof idx !== 'number' || idx < 0 || idx >= wishlist.items.length) continue;
      const item = wishlist.items[idx];

      try {
        switch (change.action) {
          case 'rename':
            if (change.newTitle) {
              await prisma.wishlistItem.update({
                where: { id: item.id },
                data: { title: String(change.newTitle).trim() },
              });
              applied++;
            }
            break;
          case 'categorize':
            if (change.category) {
              await prisma.wishlistItem.update({
                where: { id: item.id },
                data: { category: String(change.category) },
              });
              applied++;
            }
            break;
          case 'brand':
            if (change.brand) {
              await prisma.wishlistItem.update({
                where: { id: item.id },
                data: { brand: String(change.brand) },
              });
              applied++;
            }
            break;
          case 'duplicate':
            if (typeof change.duplicateOf === 'number') {
              await prisma.wishlistItem.update({
                where: { id: item.id },
                data: {
                  notes:
                    `[Duplicate of: ${wishlist.items[change.duplicateOf]?.title || `item #${change.duplicateOf + 1}`}] ${item.notes || ''}`.trim(),
                },
              });
              applied++;
            }
            break;
          case 'priority':
            if (change.priority) {
              const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
              if (validPriorities.includes(change.priority)) {
                await prisma.wishlistItem.update({
                  where: { id: item.id },
                  data: { priority: change.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' },
                });
                applied++;
              }
            }
            break;
        }
      } catch {
        // Skip individual failures
      }
    }

    revalidatePath(`/wishlists/${wishlistId}`);
    revalidatePath('/dashboard');
    return NextResponse.json({ success: true, applied });
  }

  // ─── ANALYZE MODE: call AI and return changes ───
  const providers = getProviderManager();
  const aiProvider = await providers.getAIProvider(user.id);
  if (!aiProvider) {
    return NextResponse.json(
      { error: 'No AI provider configured. Add one in Settings → Providers.' },
      { status: 400 }
    );
  }

  const itemList = wishlist.items
    .map((item, i) => {
      const parts = [`${i}. "${item.title}"`];
      if (item.brand) parts.push(`brand:"${item.brand}"`);
      if (item.category) parts.push(`cat:"${item.category}"`);
      if (item.retailer) parts.push(`retailer:"${item.retailer}"`);
      if (item.currentPrice) parts.push(`$${item.currentPrice}`);
      return parts.join(' ');
    })
    .join('\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `You are a wishlist organizer AI. Analyze every product and return improvements.

Return ONLY this JSON structure:
{
  "changes": [
    {"index": 0, "action": "rename", "newTitle": "Clean product title"},
    {"index": 1, "action": "categorize", "category": "Category Name"},
    {"index": 2, "action": "brand", "brand": "Normalized Brand"},
    {"index": 3, "action": "duplicate", "duplicateOf": 0},
    {"index": 4, "action": "priority", "priority": "HIGH"}
  ],
  "suggestions": ["Human-readable summary of each key change"]
}

Actions:
- "rename": Clean title. Remove promotional text (FREE SHIPPING, LIMITED TIME, SALE, etc.), fix capitalization, standardize format as "Brand Model Description".
- "categorize": Assign a category to uncategorized items or fix wrong categories. Use concise names like "Graphics Cards", "Monitors", "Audio", "Storage", "Peripherals".
- "brand": Normalize brand name casing/spelling (e.g. "apple" → "Apple", "NVIDIA" → "NVIDIA", "corsair" → "Corsair").
- "duplicate": Mark item as duplicate if nearly identical to another item. duplicateOf is the index of the original.
- "priority": Suggest priority change only if obviously mismatched (e.g. expensive critical item marked LOW).

Rules:
- Only include changes that genuinely improve the wishlist
- One change per item maximum (pick the most impactful action)
- Do NOT rename items that already have clean titles
- Do NOT categorize items that already have correct categories
- Do NOT mark items as duplicates unless they are clearly the same product
- Keep category names concise (2-3 words max)
- Maximum 50 changes total`,
    },
    {
      role: 'user',
      content: `Organize this wishlist (${wishlist.items.length} items):\n\n${itemList}`,
    },
  ];

  try {
    const response = await aiProvider.chat(messages, {
      maxTokens: 3000,
      temperature: 0.15,
      json: true,
    });

    let parsed;
    try {
      let jsonStr = response.content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { success: false, error: 'AI returned invalid response' },
        { status: 500 }
      );
    }

    const changes: OrganizerChange[] = Array.isArray(parsed.changes)
      ? parsed.changes.filter(
          (c: OrganizerChange) =>
            typeof c.index === 'number' &&
            c.index >= 0 &&
            c.index < wishlist.items.length &&
            ['rename', 'categorize', 'brand', 'duplicate', 'priority'].includes(c.action)
        )
      : [];

    // Compute real stats from the changes array
    const stats = {
      duplicates: changes.filter((c) => c.action === 'duplicate').length,
      titlesImproved: changes.filter((c) => c.action === 'rename').length,
      descriptionsCleaned: 0,
      categoriesCreated: new Set(
        changes.filter((c) => c.action === 'categorize').map((c) => c.category)
      ).size,
      foldersCreated: 0,
      itemsReorganized: changes.filter((c) => c.action === 'categorize').length,
      detailsAdded: changes.filter((c) => c.action === 'brand').length,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [],
    };

    return NextResponse.json({
      success: true,
      analysis: stats,
      changes,
    });
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
