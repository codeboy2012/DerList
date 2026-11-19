/**
 * Bulk product management.
 *
 * These exercise the real Server Action against the local PostgreSQL database
 * with two isolated accounts, covering selection scoping, partial results and
 * cross-account attempts.
 */
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

describe.skipIf(!hasDatabase)('bulk product management', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let actions: typeof import('@/app/(app)/wishlists/[id]/bulk-actions');

  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string };
  let otherCollectionA: { id: string };
  let collectionB: { id: string };
  let itemsA: Array<{ id: string }>;
  let itemOtherA: { id: string };
  let itemB: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    actions = await import('@/app/(app)/wishlists/[id]/bulk-actions');

    userA = await prisma.user.create({
      data: {
        email: `bulk-a-${suffix}@example.test`,
        username: `bulk-a-${suffix}`,
        displayName: 'Bulk A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `bulk-b-${suffix}@example.test`,
        username: `bulk-b-${suffix}`,
        displayName: 'Bulk B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    collectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Bulk A', slug: `bulk-a-${stamp}` },
      select: { id: true },
    });
    otherCollectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Bulk A other', slug: `bulk-a2-${stamp}` },
      select: { id: true },
    });
    collectionB = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: 'Bulk B', slug: `bulk-b-${stamp}` },
      select: { id: true },
    });

    itemsA = [];
    for (let index = 0; index < 3; index++) {
      const item = await prisma.wishlistItem.create({
        data: {
          wishlistId: collectionA.id,
          title: `A item ${index}`,
          notes: `note ${index}`,
          url: `https://example.com/a-${stamp}-${index}`,
          metadata: JSON.stringify({ enriched: true, index }),
          targetPrice: 10 + index,
          position: index,
        },
        select: { id: true },
      });
      itemsA.push(item);
    }

    itemOtherA = await prisma.wishlistItem.create({
      data: { wishlistId: otherCollectionA.id, title: 'Other A item', position: 0 },
      select: { id: true },
    });
    itemB = await prisma.wishlistItem.create({
      data: { wishlistId: collectionB.id, title: 'B item', position: 0 },
      select: { id: true },
    });

    session.user = { id: userA.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  const bulk = (
    operation: string,
    itemIds: string[],
    extra: Record<string, string> = {},
    wishlistId = collectionA.id
  ) =>
    actions.bulkItemAction(
      IDLE,
      formData({
        wishlistId,
        itemIds: JSON.stringify(itemIds),
        operation,
        ...extra,
      })
    );

  it('updates priority only for the selected products', async () => {
    const result = await bulk('priority', [itemsA[0].id, itemsA[1].id], { starPriority: '4' });

    expect(result.success).toBe(true);
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);

    const changed = await prisma.wishlistItem.findMany({
      where: { id: { in: [itemsA[0].id, itemsA[1].id] } },
    });
    expect(changed.every((item) => item.starPriority === 4)).toBe(true);
    expect(changed.every((item) => item.priority === 'CRITICAL')).toBe(true);

    const untouched = await prisma.wishlistItem.findUnique({ where: { id: itemsA[2].id } });
    expect(untouched?.starPriority).toBe(1);
    expect(untouched?.priority).toBe('MEDIUM');
  });

  it('creates the category record and links selected products to it', async () => {
    const result = await bulk('category', [itemsA[0].id, itemsA[2].id], {
      category: 'Smart Home',
    });

    expect(result.success).toBe(true);
    expect(result.updated).toBe(2);

    const category = await prisma.wishlistCategory.findFirst({
      where: { wishlistId: collectionA.id, name: 'Smart Home' },
      select: { id: true },
    });
    expect(category).not.toBeNull();

    const changed = await prisma.wishlistItem.findMany({
      where: { id: { in: [itemsA[0].id, itemsA[2].id] } },
    });
    expect(changed.every((item) => item.category === 'Smart Home')).toBe(true);
    expect(changed.every((item) => item.wishlistCategoryId === category!.id)).toBe(true);

    const untouched = await prisma.wishlistItem.findUnique({ where: { id: itemsA[1].id } });
    expect(untouched?.category).toBeNull();
  });

  it('clears the category when the bulk category is empty', async () => {
    await bulk('category', [itemsA[0].id], { category: 'Temporary' });
    const result = await bulk('category', [itemsA[0].id], { category: '' });

    expect(result.updated).toBe(1);
    const item = await prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } });
    expect(item?.category).toBeNull();
    expect(item?.wishlistCategoryId).toBeNull();
  });

  it('moves products between collections while preserving their data', async () => {
    await prisma.wishlistCategory.create({
      data: { wishlistId: collectionA.id, name: 'Audio' },
    });
    const targetCategory = await prisma.wishlistCategory.create({
      data: { wishlistId: otherCollectionA.id, name: 'Audio' },
      select: { id: true },
    });
    await prisma.wishlistItem.update({
      where: { id: itemsA[0].id },
      data: {
        description: 'Move description',
        image: 'https://example.com/move-image.jpg',
        brand: 'Move Brand',
        model: 'MV-1',
        condition: 'New',
        retailer: 'Move Store',
        currentPrice: 249.99,
        originalPrice: 299.99,
        currency: 'USD',
        dealInfo: 'Move deal',
        priority: 'CRITICAL',
        starPriority: 4,
        quantity: 3,
        availability: 'In stock',
        category: 'Audio',
        wishlistCategoryId: (
          await prisma.wishlistCategory.findFirstOrThrow({
            where: { wishlistId: collectionA.id, name: 'Audio' },
          })
        ).id,
      },
    });

    const before = await prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } });
    const result = await bulk(
      'move',
      [itemsA[0].id],
      { targetCollectionId: otherCollectionA.id },
      collectionA.id
    );

    expect(result.success).toBe(true);
    expect(result.updated).toBe(1);
    expect(result.message).toContain('Moved');

    const moved = await prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } });
    expect(moved?.wishlistId).toBe(otherCollectionA.id);
    expect(moved?.title).toBe(before?.title);
    expect(moved?.description).toBe('Move description');
    expect(moved?.notes).toBe(before?.notes);
    expect(moved?.url).toBe(before?.url);
    expect(moved?.image).toBe('https://example.com/move-image.jpg');
    expect(moved?.brand).toBe('Move Brand');
    expect(moved?.model).toBe('MV-1');
    expect(moved?.condition).toBe('New');
    expect(moved?.retailer).toBe('Move Store');
    expect(moved?.currentPrice?.toString()).toBe('249.99');
    expect(moved?.originalPrice?.toString()).toBe('299.99');
    expect(moved?.currency).toBe('USD');
    expect(moved?.dealInfo).toBe('Move deal');
    expect(moved?.priority).toBe('CRITICAL');
    expect(moved?.starPriority).toBe(4);
    expect(moved?.quantity).toBe(3);
    expect(moved?.availability).toBe('In stock');
    expect(moved?.metadata).toBe(before?.metadata);
    expect(moved?.targetPrice?.toString()).toBe(before?.targetPrice?.toString());
    expect(moved?.wishlistCategoryId).toBe(targetCategory.id);

    const sourceIds = await prisma.wishlistItem.findMany({
      where: { wishlistId: collectionA.id },
      select: { id: true },
    });
    expect(sourceIds.map((item) => item.id)).not.toContain(itemsA[0].id);
  });

  it('archives and restores selected products', async () => {
    const archived = await bulk('archive', [itemsA[0].id, itemsA[1].id]);
    expect(archived.success).toBe(true);
    expect(archived.updated).toBe(2);

    const stored = await prisma.wishlistItem.findMany({
      where: { id: { in: [itemsA[0].id, itemsA[1].id] } },
    });
    expect(stored.every((item) => item.archived)).toBe(true);
    expect(stored.every((item) => item.archivedAt instanceof Date)).toBe(true);

    const active = await prisma.wishlistItem.findMany({
      where: { wishlistId: collectionA.id, archived: false },
      select: { id: true },
    });
    expect(active.map((item) => item.id)).toEqual([itemsA[2].id]);

    const restored = await bulk('restore', [itemsA[0].id]);
    expect(restored.updated).toBe(1);

    const restoredItem = await prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } });
    expect(restoredItem?.archived).toBe(false);
    expect(restoredItem?.archivedAt).toBeNull();
  });

  it('deletes only the selected active products', async () => {
    const result = await bulk('delete', [itemsA[1].id], { mode: 'active' });

    expect(result.updated).toBe(1);
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemsA[1].id } })
    ).resolves.toBeNull();
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } })
    ).resolves.not.toBeNull();
  });

  it('requires an explicit archive state for deletion', async () => {
    // Omitted mode: the action rejects it instead of deleting everything.
    const omitted = await bulk('delete', [itemsA[0].id]);
    expect(omitted.success).toBe(false);
    expect(omitted.updated).toBe(0);
    expect(omitted.error).toBe('Choose whether to delete active or archived products.');
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } })
    ).resolves.not.toBeNull();

    // Invalid and forged values are rejected by validation.
    const invalid = await bulk('delete', [itemsA[0].id], { mode: 'all' });
    expect(invalid.success).toBe(false);
    expect(invalid.error).toBe('Invalid bulk action.');

    const forged = await bulk('delete', [itemsA[0].id], { mode: 'ACTIVE' });
    expect(forged.success).toBe(false);
    expect(forged.error).toBe('Invalid bulk action.');

    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } })
    ).resolves.not.toBeNull();
  });

  it('refuses deletion at the service layer when mode is omitted', async () => {
    const { runBulkAction } = await import('@/lib/services/wishlist-bulk');

    const result = await runBulkAction({
      userId: userA.id,
      wishlistId: collectionA.id,
      itemIds: [itemsA[0].id],
      operation: 'delete',
    });

    expect(result.success).toBe(false);
    expect(result.updated).toBe(0);
    expect(result.error).toBe('Choose whether to delete active or archived products.');
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } })
    ).resolves.not.toBeNull();
  });

  it('deletes only items in the requested archive state for mixed selections', async () => {
    const archivedItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionA.id,
        title: 'Archived selection item',
        archived: true,
        archivedAt: new Date(),
        position: 10,
      },
      select: { id: true },
    });

    const activeOnly = await bulk('delete', [itemsA[0].id, archivedItem.id], { mode: 'active' });
    expect(activeOnly.updated).toBe(1);
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } })
    ).resolves.toBeNull();
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } })
    ).resolves.not.toBeNull();

    const archivedOnly = await bulk('delete', [itemsA[1].id, archivedItem.id], {
      mode: 'archived',
    });
    expect(archivedOnly.updated).toBe(1);
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemsA[1].id } })
    ).resolves.not.toBeNull();
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } })
    ).resolves.toBeNull();
  });

  it('does not delete foreign ids in either archive mode', async () => {
    const foreignArchived = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionB.id,
        title: 'Foreign archived item',
        archived: true,
        archivedAt: new Date(),
      },
      select: { id: true },
    });

    const active = await bulk('delete', [itemB.id], { mode: 'active' });
    const archived = await bulk('delete', [foreignArchived.id], { mode: 'archived' });

    expect(active.updated).toBe(0);
    expect(archived.updated).toBe(0);
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemB.id } })
    ).resolves.not.toBeNull();
    await expect(
      prisma.wishlistItem.findUnique({ where: { id: foreignArchived.id } })
    ).resolves.not.toBeNull();
  });

  it('reports partial results when a selection contains foreign ids', async () => {
    const result = await bulk('priority', [itemsA[0].id, itemB.id], { starPriority: '2' });

    expect(result.success).toBe(true);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);

    const own = await prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } });
    expect(own?.starPriority).toBe(2);

    const foreign = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(foreign?.starPriority).toBe(1);
    expect(foreign?.wishlistId).toBe(collectionB.id);
  });

  it('does not create a category when the selection is entirely foreign', async () => {
    const before = await prisma.wishlistCategory.count({ where: { wishlistId: collectionA.id } });

    const result = await bulk('category', [itemB.id], { category: 'Ghost category' });

    expect(result.updated).toBe(0);
    expect(await prisma.wishlistCategory.count({ where: { wishlistId: collectionA.id } })).toBe(
      before
    );
  });

  it("cannot archive or delete another user's products", async () => {
    const archived = await bulk('archive', [itemB.id]);
    expect(archived.updated).toBe(0);

    const deleted = await bulk('delete', [itemB.id]);
    expect(deleted.updated).toBe(0);

    const foreign = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(foreign).not.toBeNull();
    expect(foreign?.archived).toBe(false);
  });

  it("cannot move products into another user's collection", async () => {
    const result = await bulk(
      'move',
      [itemsA[0].id],
      { targetCollectionId: collectionB.id },
      collectionA.id
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Collection not found or archived.');

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemsA[0].id } });
    expect(stored?.wishlistId).toBe(collectionA.id);
  });

  it("rejects a bulk action submitted with another user's collection", async () => {
    const result = await bulk('archive', [itemB.id], {}, collectionB.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Wishlist not found.');

    const foreign = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(foreign?.archived).toBe(false);
  });

  it('rejects malformed selections and unknown operations', async () => {
    const malformed = await actions.bulkItemAction(
      IDLE,
      formData({ wishlistId: collectionA.id, itemIds: 'not-json', operation: 'archive' })
    );
    expect(malformed.success).toBe(false);
    expect(malformed.error).toBe('Invalid selection.');

    const unknown = await bulk('explode', [itemsA[0].id]);
    expect(unknown.success).toBe(false);

    const invalidPriority = await bulk('priority', [itemsA[0].id], { starPriority: '9' });
    expect(invalidPriority.success).toBe(false);

    const empty = await bulk('archive', []);
    expect(empty.success).toBe(false);
  });

  it('ignores items from another collection owned by the same user', async () => {
    const result = await bulk('priority', [itemOtherA.id], { starPriority: '3' });

    expect(result.updated).toBe(0);
    const other = await prisma.wishlistItem.findUnique({ where: { id: itemOtherA.id } });
    expect(other?.starPriority).toBe(1);
  });
});
