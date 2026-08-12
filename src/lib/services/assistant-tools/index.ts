/**
 * Assistant Tools — Wishlist agent actions
 *
 * Server-side tool execution for the Shopping Assistant.
 * Every tool:
 * - Checks permissions before executing
 * - Validates input
 * - Verifies ownership
 * - Returns structured results
 * - Never trusts model-generated user/ownership data
 */

import { prisma } from '@/lib/prisma';
import { WishlistRepository, type WishlistItemCreateInput } from '@/lib/repositories';
import { wishlistEvents, generateOperationId } from '@/lib/events/wishlist-events';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  tool: string;
  data?: unknown;
  error?: string;
  /** Human-readable activity message for the UI */
  activity: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export type AIPermissions = Record<string, boolean>;

// ─────────────────────────────────────────────────────────────────────────────
// Permission Mapping
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_PERMISSIONS: Record<string, string> = {
  get_wishlist: 'wishlist.read',
  add_to_wishlist: 'wishlist.add',
  add_multiple_to_wishlist: 'wishlist.add',
  remove_from_wishlist: 'wishlist.remove',
  remove_multiple_from_wishlist: 'wishlist.remove',
  update_wishlist_item: 'wishlist.update',
  reorder_wishlist_item: 'wishlist.update',
  clear_wishlist: 'wishlist.clear',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions (for the system prompt)
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  'AVAILABLE TOOLS:',
  'Invoke tools by including a JSON action block in your response:',
  '',
  '```action',
  '{"tool": "TOOL_NAME", "args": {ARGUMENTS}}',
  '```',
  '',
  'Tools:',
  '',
  '1. get_wishlist — View wishlist items. Args: {}',
  '',
  '2. add_to_wishlist — Add ONE item. Args: {"title": "Name", "category": "Cat", "currentPrice": 99, "url": "...", "notes": "...", "starPriority": 4}. Required: title.',
  '',
  '3. add_multiple_to_wishlist — Bulk add. Args: {"items": [{...}, {...}]}. Required per item: title. Use for imports/lists (all items in ONE call).',
  '',
  '4. remove_from_wishlist — Remove ONE item. Args: {"itemId": "the-id"}. Need ID from get_wishlist.',
  '',
  '5. remove_multiple_from_wishlist — Bulk remove. Args: {"itemIds": ["id1","id2",...]} OR {"lastImport": true} to undo last batch import. Use for bulk removals.',
  '',
  '6. update_wishlist_item — Edit item. Args: {"itemId": "id", "changes": {"notes": "...", "category": "...", "starPriority": 3}}',
  '',
  '7. clear_wishlist — Remove ALL items. Args: {}. Only when explicitly requested.',
  '',
  'RULES:',
  '- For bulk ops use add_multiple/remove_multiple (ONE call, not many singles).',
  '- Use {"lastImport": true} when user says "remove what I just imported".',
  '- Never claim success unless the tool result confirms it.',
  '- Ask which item if ambiguous for single removals.',
  '- Do NOT include action blocks unless executing a tool.',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// Tool Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse tool calls from AI response content.
 * Looks for ```action blocks. Rejects truncated/malformed JSON.
 */
export function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const pattern = /```action\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.tool && typeof parsed.tool === 'string') {
        calls.push({
          tool: parsed.tool,
          args: parsed.args && typeof parsed.args === 'object' ? parsed.args : {},
        });
      }
    } catch {
      // Malformed/truncated JSON — do NOT execute partial tool calls.
      console.warn('[Assistant Tools] Rejected malformed action block (truncated JSON)');
    }
  }

  return calls;
}

/**
 * Remove tool call blocks from the AI response content.
 */
export function stripToolCalls(content: string): string {
  return content.replace(/```action\s*\n?[\s\S]*?```/g, '').trim();
}

/**
 * Execute a single tool call with permission checks.
 */
export async function executeTool(
  userId: string,
  call: ToolCall,
  permissions: AIPermissions
): Promise<ToolResult> {
  const { tool, args } = call;

  const requiredPerm = TOOL_PERMISSIONS[tool];
  if (!requiredPerm) {
    return { success: false, tool, error: `Unknown tool: ${tool}`, activity: 'Unknown action' };
  }

  if (!permissions[requiredPerm]) {
    return {
      success: false,
      tool,
      error: `Permission denied: ${requiredPerm} is not enabled. Enable it in Settings → AI Settings.`,
      activity: `Permission denied for ${tool}`,
    };
  }

  switch (tool) {
    case 'get_wishlist':
      return executeGetWishlist(userId);
    case 'add_to_wishlist':
      return executeAddToWishlist(userId, args);
    case 'add_multiple_to_wishlist':
      return executeAddMultipleToWishlist(userId, args);
    case 'remove_from_wishlist':
      return executeRemoveFromWishlist(userId, args);
    case 'remove_multiple_from_wishlist':
      return executeRemoveMultipleFromWishlist(userId, args);
    case 'update_wishlist_item':
      return executeUpdateWishlistItem(userId, args);
    case 'reorder_wishlist_item':
      return executeReorderWishlistItem(userId, args);
    case 'clear_wishlist':
      return executeClearWishlist(userId);
    default:
      return { success: false, tool, error: 'Not implemented', activity: 'Unknown action' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

async function executeGetWishlist(userId: string): Promise<ToolResult> {
  try {
    const wishlists = await prisma.wishlist.findMany({
      where: { ownerId: userId, archived: false },
      include: {
        items: {
          where: { purchased: false },
          orderBy: { position: 'asc' },
          take: 100,
          select: { id: true, title: true, brand: true, retailer: true, currentPrice: true, currency: true, category: true, url: true, notes: true, starPriority: true },
        },
        _count: { select: { items: true } },
      },
    });

    const summary = wishlists.map((wl) => ({
      id: wl.id,
      title: wl.title,
      totalItems: wl._count.items,
      items: wl.items.map((item) => ({
        id: item.id, title: item.title, brand: item.brand, retailer: item.retailer,
        price: item.currentPrice ? Number(item.currentPrice) : null, currency: item.currency,
        category: item.category, url: item.url, notes: item.notes, priority: item.starPriority,
      })),
    }));

    const totalItems = summary.reduce((sum, wl) => sum + wl.items.length, 0);
    return { success: true, tool: 'get_wishlist', data: summary, activity: `Loaded wishlist (${totalItems} items)` };
  } catch (err) {
    return { success: false, tool: 'get_wishlist', error: err instanceof Error ? err.message : 'Failed', activity: 'Failed to load wishlist' };
  }
}

async function executeAddToWishlist(userId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const title = args.title as string | undefined;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { success: false, tool: 'add_to_wishlist', error: 'title is required', activity: 'Failed to add item (no title)' };
  }

  try {
    const wishlist = await getOrCreateWishlist(userId);

    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, title: { equals: title.trim(), mode: 'insensitive' }, purchased: false },
      select: { id: true, title: true },
    });

    if (existing) {
      return { success: true, tool: 'add_to_wishlist', data: { id: existing.id, title: existing.title, status: 'already_exists' }, activity: `"${title.trim()}" already in wishlist` };
    }

    const item = await WishlistRepository.addItem({
      wishlistId: wishlist.id,
      title: title.trim(),
      brand: (args.brand as string) || undefined,
      retailer: (args.retailer as string) || undefined,
      currentPrice: typeof args.currentPrice === 'number' ? args.currentPrice : undefined,
      url: (args.url as string) || undefined,
      image: (args.image as string) || undefined,
      category: (args.category as string) || undefined,
      notes: (args.notes as string) || undefined,
      starPriority: typeof args.starPriority === 'number' ? Math.max(1, Math.min(4, args.starPriority)) : undefined,
    });

    wishlistEvents.emit({
      type: 'wishlist.item.added', userId, wishlistId: wishlist.id,
      operationId: generateOperationId(), timestamp: new Date().toISOString(),
      item: { id: item.id, title: item.title, price: typeof args.currentPrice === 'number' ? args.currentPrice : null, category: (args.category as string) || null, status: 'added' },
    });

    return { success: true, tool: 'add_to_wishlist', data: { id: item.id, title: item.title, status: 'added' }, activity: `Added "${title.trim()}"` };
  } catch (err) {
    return { success: false, tool: 'add_to_wishlist', error: err instanceof Error ? err.message : 'Failed', activity: `Failed to add "${title.trim()}"` };
  }
}

async function executeAddMultipleToWishlist(userId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const rawItems = args.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { success: false, tool: 'add_multiple_to_wishlist', error: 'items array required', activity: 'Failed (no items)' };
  }

  // Validate items
  const items: { title: string; brand?: string; retailer?: string; currentPrice?: number; url?: string; image?: string; category?: string; notes?: string; starPriority?: number }[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    if (!title) continue;
    items.push({
      title,
      brand: typeof r.brand === 'string' ? r.brand : undefined,
      retailer: typeof r.retailer === 'string' ? r.retailer : undefined,
      currentPrice: typeof r.currentPrice === 'number' ? r.currentPrice : undefined,
      url: typeof r.url === 'string' ? r.url : undefined,
      image: typeof r.image === 'string' ? r.image : undefined,
      category: typeof r.category === 'string' ? r.category : undefined,
      notes: typeof r.notes === 'string' ? r.notes : undefined,
      starPriority: typeof r.starPriority === 'number' ? Math.max(1, Math.min(4, r.starPriority)) : undefined,
    });
  }

  if (items.length === 0) {
    return { success: false, tool: 'add_multiple_to_wishlist', error: 'No valid items', activity: 'Failed (no valid items)' };
  }

  try {
    const wishlist = await getOrCreateWishlist(userId);

    // Get existing titles for dedup
    const existingItems = await prisma.wishlistItem.findMany({
      where: { wishlistId: wishlist.id, purchased: false },
      select: { id: true, title: true },
    });
    const existingLower = new Map(existingItems.map((i) => [i.title.toLowerCase(), i]));

    // Generate a batch ID for tracking
    const batchId = `import_${Date.now()}`;
    const operationId = generateOperationId();
    const results: { title: string; status: string; id?: string }[] = [];
    let added = 0, alreadyExists = 0, failed = 0;

    // Emit import started
    wishlistEvents.emit({
      type: 'wishlist.import.started',
      userId, wishlistId: wishlist.id, operationId,
      timestamp: new Date().toISOString(),
      progress: { total: items.length, completed: 0 },
    });

    for (const item of items) {
      const match = existingLower.get(item.title.toLowerCase());
      if (match) {
        results.push({ title: item.title, status: 'already_exists', id: match.id });
        alreadyExists++;
        wishlistEvents.emit({
          type: 'wishlist.import.progress', userId, wishlistId: wishlist.id, operationId,
          timestamp: new Date().toISOString(),
          item: { id: match.id, title: item.title, status: 'already_exists' },
          progress: { total: items.length, completed: added + alreadyExists + failed },
        });
        continue;
      }

      try {
        const meta = JSON.stringify({ importBatch: batchId, importedAt: new Date().toISOString() });

        const created = await prisma.wishlistItem.create({
          data: {
            wishlistId: wishlist.id,
            title: item.title,
            brand: item.brand ?? null,
            retailer: item.retailer ?? null,
            currentPrice: item.currentPrice ?? null,
            currency: 'USD',
            url: item.url ?? null,
            image: item.image ?? null,
            category: item.category ?? null,
            notes: item.notes ?? null,
            starPriority: item.starPriority ?? 1,
            position: (await getNextPosition(wishlist.id)),
            metadata: meta,
          },
        });

        results.push({ title: item.title, status: 'added', id: created.id });
        existingLower.set(item.title.toLowerCase(), { id: created.id, title: item.title });
        added++;

        // Emit item added event
        wishlistEvents.emit({
          type: 'wishlist.item.added', userId, wishlistId: wishlist.id, operationId,
          timestamp: new Date().toISOString(),
          item: { id: created.id, title: item.title, price: item.currentPrice, category: item.category, priority: item.starPriority, status: 'added' },
          progress: { total: items.length, completed: added + alreadyExists + failed },
        });
      } catch (err) {
        results.push({ title: item.title, status: 'failed' });
        failed++;
      }
    }

    const parts: string[] = [];
    if (added > 0) parts.push(`${added} added`);
    if (alreadyExists > 0) parts.push(`${alreadyExists} already existed`);
    if (failed > 0) parts.push(`${failed} failed`);

    // Emit import completed
    wishlistEvents.emit({
      type: 'wishlist.import.completed', userId, wishlistId: wishlist.id, operationId,
      timestamp: new Date().toISOString(),
      result: { total: items.length, added, alreadyExists, failed },
    });

    return {
      success: true,
      tool: 'add_multiple_to_wishlist',
      data: { total: items.length, added, alreadyExists, failed, batchId, operationId, results },
      activity: `Imported ${items.length} items: ${parts.join(', ')}`,
    };
  } catch (err) {
    return { success: false, tool: 'add_multiple_to_wishlist', error: err instanceof Error ? err.message : 'Failed', activity: 'Failed to import' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK REMOVE
// ─────────────────────────────────────────────────────────────────────────────

async function executeRemoveMultipleFromWishlist(userId: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const wishlist = await prisma.wishlist.findFirst({
      where: { ownerId: userId, archived: false },
      select: { id: true },
    });

    if (!wishlist) {
      return { success: false, tool: 'remove_multiple_from_wishlist', error: 'No wishlist found', activity: 'No wishlist' };
    }

    let itemsToRemove: { id: string; title: string }[] = [];

    // Mode 1: Remove last import batch
    if (args.lastImport === true) {
      // Find items with importBatch metadata, get the most recent batch
      const allItems = await prisma.wishlistItem.findMany({
        where: { wishlistId: wishlist.id, purchased: false, metadata: { not: null } },
        select: { id: true, title: true, metadata: true },
        orderBy: { createdAt: 'desc' },
      });

      // Parse metadata to find the most recent batch
      let latestBatchId: string | null = null;
      const batchItems: { id: string; title: string }[] = [];

      for (const item of allItems) {
        if (!item.metadata) continue;
        try {
          const meta = JSON.parse(item.metadata);
          if (meta.importBatch) {
            if (!latestBatchId) latestBatchId = meta.importBatch;
            if (meta.importBatch === latestBatchId) {
              batchItems.push({ id: item.id, title: item.title });
            }
          }
        } catch {
          // Skip items with invalid metadata
        }
      }

      if (batchItems.length === 0) {
        return { success: true, tool: 'remove_multiple_from_wishlist', data: { total: 0, removed: 0, failed: 0, results: [] }, activity: 'No recent import batch found' };
      }

      itemsToRemove = batchItems;
    }
    // Mode 2: Remove by explicit item IDs
    else if (Array.isArray(args.itemIds) && args.itemIds.length > 0) {
      const ids = (args.itemIds as string[]).filter((id) => typeof id === 'string');
      if (ids.length === 0) {
        return { success: false, tool: 'remove_multiple_from_wishlist', error: 'No valid IDs', activity: 'No valid item IDs' };
      }

      // Verify all items belong to this user
      const items = await prisma.wishlistItem.findMany({
        where: { id: { in: ids }, wishlist: { ownerId: userId }, purchased: false },
        select: { id: true, title: true },
      });

      itemsToRemove = items;
    } else {
      return { success: false, tool: 'remove_multiple_from_wishlist', error: 'Provide itemIds array or lastImport: true', activity: 'Invalid arguments' };
    }

    // Execute removals
    const operationId = generateOperationId();
    const results: { title: string; status: string; id: string }[] = [];
    let removed = 0, failed = 0;

    wishlistEvents.emit({
      type: 'wishlist.remove.started', userId, wishlistId: wishlist.id, operationId,
      timestamp: new Date().toISOString(),
      progress: { total: itemsToRemove.length, completed: 0 },
    });

    for (const item of itemsToRemove) {
      try {
        await prisma.wishlistItem.delete({ where: { id: item.id } });
        results.push({ title: item.title, status: 'removed', id: item.id });
        removed++;

        wishlistEvents.emit({
          type: 'wishlist.item.removed', userId, wishlistId: wishlist.id, operationId,
          timestamp: new Date().toISOString(),
          item: { id: item.id, title: item.title, status: 'removed' },
          progress: { total: itemsToRemove.length, completed: removed + failed },
        });
      } catch {
        results.push({ title: item.title, status: 'failed', id: item.id });
        failed++;
      }
    }

    wishlistEvents.emit({
      type: 'wishlist.remove.completed', userId, wishlistId: wishlist.id, operationId,
      timestamp: new Date().toISOString(),
      result: { total: itemsToRemove.length, removed, failed },
    });

    const parts: string[] = [];
    if (removed > 0) parts.push(`${removed} removed`);
    if (failed > 0) parts.push(`${failed} failed`);

    return {
      success: true,
      tool: 'remove_multiple_from_wishlist',
      data: { total: itemsToRemove.length, removed, failed, operationId, results },
      activity: `Removed ${removed} items${failed > 0 ? `, ${failed} failed` : ''}`,
    };
  } catch (err) {
    return { success: false, tool: 'remove_multiple_from_wishlist', error: err instanceof Error ? err.message : 'Failed', activity: 'Failed to remove items' };
  }
}

async function executeRemoveFromWishlist(userId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const itemId = args.itemId as string | undefined;
  if (!itemId || typeof itemId !== 'string') {
    return { success: false, tool: 'remove_from_wishlist', error: 'itemId is required', activity: 'Failed (no ID)' };
  }

  try {
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: { wishlist: { select: { ownerId: true } } },
    });

    if (!item || item.wishlist.ownerId !== userId) {
      return { success: false, tool: 'remove_from_wishlist', error: 'Not found or access denied', activity: 'Item not found' };
    }

    await WishlistRepository.deleteItem(itemId);

    wishlistEvents.emit({
      type: 'wishlist.item.removed', userId, operationId: generateOperationId(),
      timestamp: new Date().toISOString(),
      item: { id: itemId, title: item.title, status: 'removed' },
    });

    return { success: true, tool: 'remove_from_wishlist', data: { id: itemId, title: item.title }, activity: `Removed "${item.title}"` };
  } catch (err) {
    return { success: false, tool: 'remove_from_wishlist', error: err instanceof Error ? err.message : 'Failed', activity: 'Failed to remove' };
  }
}

async function executeUpdateWishlistItem(userId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const itemId = args.itemId as string | undefined;
  const changes = args.changes as Record<string, unknown> | undefined;

  if (!itemId || !changes) {
    return { success: false, tool: 'update_wishlist_item', error: 'itemId and changes required', activity: 'Failed to update' };
  }

  try {
    const item = await prisma.wishlistItem.findUnique({ where: { id: itemId }, include: { wishlist: { select: { ownerId: true } } } });
    if (!item || item.wishlist.ownerId !== userId) {
      return { success: false, tool: 'update_wishlist_item', error: 'Not found or access denied', activity: 'Item not found' };
    }

    const safeChanges: Record<string, unknown> = {};
    if (typeof changes.notes === 'string') safeChanges.notes = changes.notes;
    if (typeof changes.category === 'string') safeChanges.category = changes.category;
    if (typeof changes.starPriority === 'number' && changes.starPriority >= 1 && changes.starPriority <= 4) safeChanges.starPriority = changes.starPriority;

    if (Object.keys(safeChanges).length === 0) {
      return { success: false, tool: 'update_wishlist_item', error: 'No valid changes', activity: 'No changes' };
    }

    await WishlistRepository.updateItem(itemId, safeChanges);
    return { success: true, tool: 'update_wishlist_item', data: { id: itemId, title: item.title, changes: safeChanges }, activity: `Updated "${item.title}"` };
  } catch (err) {
    return { success: false, tool: 'update_wishlist_item', error: err instanceof Error ? err.message : 'Failed', activity: 'Failed to update' };
  }
}

async function executeReorderWishlistItem(userId: string, args: Record<string, unknown>): Promise<ToolResult> {
  const itemId = args.itemId as string | undefined;
  const newPosition = args.newPosition as number | undefined;
  if (!itemId || typeof newPosition !== 'number') {
    return { success: false, tool: 'reorder_wishlist_item', error: 'itemId and newPosition required', activity: 'Failed to reorder' };
  }

  try {
    const item = await prisma.wishlistItem.findUnique({ where: { id: itemId }, include: { wishlist: { select: { ownerId: true } } } });
    if (!item || item.wishlist.ownerId !== userId) {
      return { success: false, tool: 'reorder_wishlist_item', error: 'Not found or access denied', activity: 'Item not found' };
    }

    await WishlistRepository.updateItem(itemId, { position: newPosition });
    return { success: true, tool: 'reorder_wishlist_item', data: { id: itemId, title: item.title, position: newPosition }, activity: `Moved "${item.title}"` };
  } catch (err) {
    return { success: false, tool: 'reorder_wishlist_item', error: err instanceof Error ? err.message : 'Failed', activity: 'Failed to reorder' };
  }
}

async function executeClearWishlist(userId: string): Promise<ToolResult> {
  try {
    const wishlists = await prisma.wishlist.findMany({ where: { ownerId: userId, archived: false }, select: { id: true } });
    if (wishlists.length === 0) {
      return { success: true, tool: 'clear_wishlist', data: { removed: 0 }, activity: 'Already empty' };
    }

    const result = await prisma.wishlistItem.deleteMany({ where: { wishlistId: { in: wishlists.map((w) => w.id) } } });
    return { success: true, tool: 'clear_wishlist', data: { removed: result.count }, activity: `Cleared (${result.count} items removed)` };
  } catch (err) {
    return { success: false, tool: 'clear_wishlist', error: err instanceof Error ? err.message : 'Failed', activity: 'Failed to clear' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getOrCreateWishlist(userId: string) {
  let wishlist = await prisma.wishlist.findFirst({
    where: { ownerId: userId, archived: false },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true },
  });

  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { ownerId: userId, title: 'My Wishlist', slug: 'my-wishlist' },
      select: { id: true, title: true },
    });
  }

  return wishlist;
}

async function getNextPosition(wishlistId: string): Promise<number> {
  const last = await prisma.wishlistItem.findFirst({
    where: { wishlistId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}
