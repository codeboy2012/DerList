/**
 * Archived-product access rules.
 *
 * Archived products can be inspected, restored and permanently deleted, but
 * they are read-only while archived. These tests exercise the real Server
 * Actions and the item editor route against PostgreSQL with two accounts.
 */
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const session: { user: { id: string; role: 'USER' } | null } = { user: null };

vi.mock('@/lib/auth', () => ({
  requireUser: async () => {
    if (!session.user) throw new Error('requireUser called without a test session');
    return session.user;
  },
  getCurrentUser: async () => session.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const IDLE = {
  success: false,
  operation: 'archive' as const,
  requested: 0,
  updated: 0,
  skipped: 0,
};

describe.skipIf(!hasDatabase)('archived product detail access', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let itemActions: typeof import('@/app/(app)/wishlists/[id]/item-actions');
  let priorityActions: typeof import('@/app/(app)/wishlists/[id]/priority-action');
  let bulkActions: typeof import('@/app/(app)/wishlists/[id]/bulk-actions');
  let itemRoute: typeof import('@/app/api/wishlists/items/[id]/route');
  let assistantTools: typeof import('@/lib/services/assistant-tools');
  let folderSuggestions: typeof import('@/lib/services/folder-suggestion');

  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string };
  let collectionB: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    itemActions = await import('@/app/(app)/wishlists/[id]/item-actions');
    priorityActions = await import('@/app/(app)/wishlists/[id]/priority-action');
    bulkActions = await import('@/app/(app)/wishlists/[id]/bulk-actions');
    itemRoute = await import('@/app/api/wishlists/items/[id]/route');
    assistantTools = await import('@/lib/services/assistant-tools');
    folderSuggestions = await import('@/lib/services/folder-suggestion');

    userA = await prisma.user.create({
      data: {
        email: `detail-a-${suffix}@example.test`,
        username: `detail-a-${suffix}`,
        displayName: 'Detail A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `detail-b-${suffix}@example.test`,
        username: `detail-b-${suffix}`,
        displayName: 'Detail B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    collectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Detail A', slug: `detail-a-${stamp}` },
      select: { id: true },
    });
    collectionB = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: 'Detail B', slug: `detail-b-${stamp}` },
      select: { id: true },
    });
    session.user = { id: userA.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  async function createItem(
    overrides: Partial<Prisma.WishlistItemUncheckedCreateInput> = {},
    wishlistId = collectionA.id
  ) {
    return prisma.wishlistItem.create({
      data: {
        wishlistId,
        title: 'Archived headphones',
        description: 'Closed-back headphones',
        notes: 'Wait for a sale',
        url: 'https://example.com/headphones',
        brand: 'Example Audio',
        model: 'X100',
        retailer: 'Example Store',
        currentPrice: 249.99,
        targetPrice: 199.99,
        originalPrice: 299.99,
        quantity: 2,
        starPriority: 3,
        priority: 'HIGH',
        category: 'Audio',
        metadata: JSON.stringify({
          tags: 'wireless, audio',
          specs: [{ key: 'Battery', value: '30', unit: 'hours' }],
        }),
        archived: true,
        archivedAt: new Date(),
        ...overrides,
      },
    });
  }

  it('rejects editing an archived product through the standard item form', async () => {
    const item = await createItem();

    const result = await itemActions.updateItemAction(
      { success: false },
      formData({
        itemId: item.id,
        wishlistId: collectionA.id,
        title: 'Edited while archived',
        currency: 'USD',
        priority: 'LOW',
        quantity: '1',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Restore this archived product');
    const stored = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
    expect(stored?.title).toBe('Archived headphones');
    expect(stored?.quantity).toBe(2);
  });

  it('rejects quick edits, detail edits and purchased toggles on archived products', async () => {
    const item = await createItem();

    const quick = await itemActions.quickEditItemAction(
      { success: false },
      formData({
        itemId: item.id,
        wishlistId: collectionA.id,
        title: 'Quick edited',
        priority: 'LOW',
        quantity: '1',
      })
    );
    expect(quick.success).toBe(false);
    expect(quick.error).toContain('Restore this archived product');

    const details = await itemActions.updateItemDetailsAction(
      { success: false },
      formData({
        itemId: item.id,
        wishlistId: collectionA.id,
        title: 'Details edited',
        priority: 'LOW',
        quantity: '1',
      })
    );
    expect(details.success).toBe(false);
    expect(details.error).toContain('Restore this archived product');

    await itemActions.togglePurchasedAction(
      formData({ itemId: item.id, wishlistId: collectionA.id })
    );

    const stored = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
    expect(stored?.purchased).toBe(false);
    expect(stored?.title).toBe('Archived headphones');
  });

  it('rejects star-priority edits and API editor writes while archived', async () => {
    const item = await createItem();

    await priorityActions.updateStarPriorityAction(
      formData({ itemId: item.id, wishlistId: collectionA.id, starPriority: '1' })
    );

    const response = await itemRoute.PATCH(
      new Request(`http://localhost/api/wishlists/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'API edit' }),
      }),
      { params: Promise.resolve({ id: item.id }) }
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain('Restore this archived product');

    const stored = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
    expect(stored?.starPriority).toBe(3);
    expect(stored?.title).toBe('Archived headphones');
  });

  it('rejects the normal API delete for archived products', async () => {
    const item = await createItem();

    const response = await itemRoute.DELETE(
      new Request(`http://localhost/api/wishlists/items/${item.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: item.id }) }
    );

    expect(response.status).toBe(409);
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: item.id } })
    ).resolves.not.toBeNull();
  });

  it('blocks assistant, folder and clear operations from mutating archived products', async () => {
    const item = await createItem();
    const permissions = {
      'wishlist.update': true,
      'wishlist.remove': true,
      'wishlist.clear': true,
    };

    const update = await assistantTools.executeTool(
      userA.id,
      {
        tool: 'update_wishlist_item',
        args: { itemId: item.id, changes: { notes: 'Assistant edit', starPriority: 1 } },
      },
      permissions
    );
    expect(update.success).toBe(false);
    expect(update.error).toContain('restored');

    const reorder = await assistantTools.executeTool(
      userA.id,
      { tool: 'reorder_wishlist_item', args: { itemId: item.id, newPosition: 5 } },
      permissions
    );
    expect(reorder.success).toBe(false);

    const remove = await assistantTools.executeTool(
      userA.id,
      { tool: 'remove_from_wishlist', args: { itemId: item.id } },
      permissions
    );
    expect(remove.success).toBe(false);

    const clear = await assistantTools.executeTool(
      userA.id,
      { tool: 'clear_wishlist', args: {} },
      permissions
    );
    expect(clear.success).toBe(true);
    expect(clear.data).toMatchObject({ removed: 0, archivedPreserved: true });

    const folderService = new folderSuggestions.FolderSuggestionService({} as never);
    await folderService.applyFolder(
      {
        wishlistId: collectionA.id,
        itemIds: [item.id],
        folderName: 'Archived folder should not exist',
      },
      userA.id
    );

    const stored = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
    expect(stored).not.toBeNull();
    expect(stored?.notes).toBe('Wait for a sale');
    expect(stored?.starPriority).toBe(3);
    expect(stored?.position).toBe(0);
    expect(stored?.category).toBe('Audio');
    await expect(
      prisma.wishlistCategory.findFirst({
        where: { wishlistId: collectionA.id, name: 'Archived folder should not exist' },
      })
    ).resolves.toBeNull();
  });

  it('restores without duplicating the item or losing metadata', async () => {
    const item = await createItem();
    const countBefore = await prisma.wishlistItem.count({ where: { wishlistId: collectionA.id } });

    const result = await bulkActions.restoreItemAction(
      formData({ itemId: item.id, wishlistId: collectionA.id })
    );

    expect(result).toBeUndefined();
    const countAfter = await prisma.wishlistItem.count({ where: { wishlistId: collectionA.id } });
    expect(countAfter).toBe(countBefore);

    const stored = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
    expect(stored?.archived).toBe(false);
    expect(stored?.archivedAt).toBeNull();
    expect(stored?.title).toBe('Archived headphones');
    expect(stored?.notes).toBe('Wait for a sale');
    expect(stored?.url).toBe('https://example.com/headphones');
    expect(stored?.description).toBe('Closed-back headphones');
    expect(stored?.brand).toBe('Example Audio');
    expect(stored?.retailer).toBe('Example Store');
    expect(stored?.currentPrice?.toString()).toBe('249.99');
    expect(stored?.quantity).toBe(2);
    expect(stored?.category).toBe('Audio');
    expect(stored?.priority).toBe('HIGH');
    expect(stored?.starPriority).toBe(3);
    expect(stored?.targetPrice?.toString()).toBe('199.99');
    expect(stored?.metadata).toBe(
      JSON.stringify({
        tags: 'wireless, audio',
        specs: [{ key: 'Battery', value: '30', unit: 'hours' }],
      })
    );
  });

  it('only permanently deletes products that are actually archived', async () => {
    const archived = await createItem();
    const active = await createItem({ archived: false, archivedAt: null, title: 'Active item' });

    await bulkActions.deleteArchivedItemAction(
      formData({ itemId: active.id, wishlistId: collectionA.id })
    );
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: active.id } })
    ).resolves.not.toBeNull();

    await bulkActions.deleteArchivedItemAction(
      formData({ itemId: archived.id, wishlistId: collectionA.id })
    );
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: archived.id } })
    ).resolves.toBeNull();
  });

  it('does not let an active bulk delete remove an archived product', async () => {
    const archived = await createItem();

    const result = await bulkActions.bulkItemAction(
      IDLE,
      formData({
        wishlistId: collectionA.id,
        itemIds: JSON.stringify([archived.id]),
        operation: 'delete',
        mode: 'active',
      })
    );

    expect(result.updated).toBe(0);
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: archived.id } })
    ).resolves.not.toBeNull();
  });

  it('skips archived products in active bulk priority changes', async () => {
    const archived = await createItem();
    const active = await createItem({ archived: false, archivedAt: null, title: 'Active item' });

    const result = await bulkActions.bulkItemAction(
      IDLE,
      formData({
        wishlistId: collectionA.id,
        itemIds: JSON.stringify([archived.id, active.id]),
        operation: 'priority',
        starPriority: '1',
        mode: 'active',
      })
    );

    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(
      (await prisma.wishlistItem.findUnique({ where: { id: archived.id } }))?.starPriority
    ).toBe(3);
    expect((await prisma.wishlistItem.findUnique({ where: { id: active.id } }))?.starPriority).toBe(
      1
    );
  });

  it('enforces the 500-item bulk cap with a clear message', async () => {
    const item = await createItem({ archived: false, archivedAt: null, title: 'Cap item' });
    const ids = Array.from({ length: 501 }, (_, index) => `missing-${item.id}-${index}`);

    const result = await bulkActions.bulkItemAction(
      IDLE,
      formData({
        wishlistId: collectionA.id,
        itemIds: JSON.stringify(ids),
        operation: 'archive',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Select up to 500 products at a time.');
    expect((await prisma.wishlistItem.findUnique({ where: { id: item.id } }))?.archived).toBe(
      false
    );
  });

  it("does not expose or mutate another user's archived product", async () => {
    const foreign = await createItem(
      { title: 'Foreign archived item', notes: 'private' },
      collectionB.id
    );

    const result = await bulkActions.bulkItemAction(
      IDLE,
      formData({
        wishlistId: collectionA.id,
        itemIds: JSON.stringify([foreign.id]),
        operation: 'delete',
        mode: 'archived',
      })
    );

    expect(result.updated).toBe(0);
    const stored = await prisma.wishlistItem.findUnique({ where: { id: foreign.id } });
    expect(stored).not.toBeNull();
    expect(stored?.title).toBe('Foreign archived item');
    expect(stored?.notes).toBe('private');
  });
});
