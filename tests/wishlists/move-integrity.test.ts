/**
 * Collection move and category integrity.
 *
 * Moving an item (bulk, product details dialog or the product API) must never
 * leave `wishlistCategoryId` pointing at a category in another collection, and
 * archived collections must not accept moves. Category text edits keep the
 * relation in sync.
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

const IDLE = {
  success: false,
  operation: 'archive' as const,
  requested: 0,
  updated: 0,
  skipped: 0,
};

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe.skipIf(!hasDatabase)('collection move and category integrity', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let itemActions: typeof import('@/app/(app)/wishlists/[id]/item-actions');
  let bulkActions: typeof import('@/app/(app)/wishlists/[id]/bulk-actions');
  let itemRoute: typeof import('@/app/api/wishlists/items/[id]/route');
  let organizeRoute: typeof import('@/app/api/wishlists/organize/route');

  let userA: { id: string };
  let userB: { id: string };
  let source: { id: string };
  let destination: { id: string };
  let archivedCollection: { id: string };
  let foreignCollection: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    itemActions = await import('@/app/(app)/wishlists/[id]/item-actions');
    bulkActions = await import('@/app/(app)/wishlists/[id]/bulk-actions');
    itemRoute = await import('@/app/api/wishlists/items/[id]/route');
    organizeRoute = await import('@/app/api/wishlists/organize/route');

    userA = await prisma.user.create({
      data: {
        email: `move-a-${suffix}@example.test`,
        username: `move-a-${suffix}`,
        displayName: 'Move A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `move-b-${suffix}@example.test`,
        username: `move-b-${suffix}`,
        displayName: 'Move B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    source = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Move source', slug: `move-src-${stamp}` },
      select: { id: true },
    });
    destination = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Move destination', slug: `move-dst-${stamp}` },
      select: { id: true },
    });
    archivedCollection = await prisma.wishlist.create({
      data: {
        ownerId: userA.id,
        title: 'Archived destination',
        slug: `move-arch-${stamp}`,
        archived: true,
      },
      select: { id: true },
    });
    foreignCollection = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: 'Foreign destination', slug: `move-b-${stamp}` },
      select: { id: true },
    });

    session.user = { id: userA.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  async function createItem(overrides: Record<string, unknown> = {}, wishlistId = source.id) {
    return prisma.wishlistItem.create({
      data: {
        wishlistId,
        title: 'Moving item',
        notes: 'Keep these notes',
        url: 'https://example.com/moving',
        brand: 'Move Brand',
        model: 'MV-100',
        condition: 'New',
        availability: 'In stock',
        retailer: 'Move Store',
        currentPrice: 249.99,
        targetPrice: 199.99,
        originalPrice: 299.99,
        dealInfo: 'Deal info',
        priority: 'HIGH',
        starPriority: 3,
        quantity: 2,
        metadata: JSON.stringify({ tags: 'keep', specs: [{ key: 'Weight', value: '1' }] }),
        position: 0,
        ...overrides,
      },
      select: { id: true },
    });
  }

  const bulk = (itemIds: string[], extra: Record<string, string> = {}) =>
    bulkActions.bulkItemAction(
      IDLE,
      formData({
        wishlistId: source.id,
        itemIds: JSON.stringify(itemIds),
        operation: 'move',
        ...extra,
      })
    );

  it('relinks to the destination category when the name matches', async () => {
    const sourceCategory = await prisma.wishlistCategory.create({
      data: { wishlistId: source.id, name: 'Audio' },
      select: { id: true },
    });
    const destinationCategory = await prisma.wishlistCategory.create({
      data: { wishlistId: destination.id, name: 'audio' },
      select: { id: true },
    });
    const item = await createItem({
      category: 'Audio',
      wishlistCategoryId: sourceCategory.id,
    });
    const before = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });

    const result = await bulk([item.id], { targetCollectionId: destination.id });

    expect(result.success).toBe(true);
    expect(result.updated).toBe(1);

    const moved = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(moved.wishlistId).toBe(destination.id);
    expect(moved.category).toBe('Audio');
    expect(moved.wishlistCategoryId).toBe(destinationCategory.id);
    expect(moved.notes).toBe(before.notes);
    expect(moved.model).toBe('MV-100');
    expect(moved.condition).toBe('New');
    expect(moved.availability).toBe('In stock');
    expect(moved.targetPrice?.toString()).toBe('199.99');
    expect(moved.metadata).toBe(before.metadata);
  });

  it('clears the relation when the destination has a different category', async () => {
    const sourceCategory = await prisma.wishlistCategory.create({
      data: { wishlistId: source.id, name: 'Audio' },
      select: { id: true },
    });
    await prisma.wishlistCategory.create({
      data: { wishlistId: destination.id, name: 'Audio Gear' },
    });
    const item = await createItem({
      category: 'Audio',
      wishlistCategoryId: sourceCategory.id,
    });

    await bulk([item.id], { targetCollectionId: destination.id });

    const moved = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(moved.wishlistId).toBe(destination.id);
    expect(moved.category).toBe('Audio');
    expect(moved.wishlistCategoryId).toBeNull();
    expect(moved.notes).toBe('Keep these notes');
  });

  it('moves an uncategorized item without creating a relation', async () => {
    const item = await createItem({ category: null, wishlistCategoryId: null });

    await bulk([item.id], { targetCollectionId: destination.id });

    const moved = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(moved.wishlistId).toBe(destination.id);
    expect(moved.category).toBeNull();
    expect(moved.wishlistCategoryId).toBeNull();
  });

  it('refuses to move into an archived collection', async () => {
    const item = await createItem();

    const result = await bulk([item.id], { targetCollectionId: archivedCollection.id });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Collection not found or archived.');
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.wishlistId).toBe(source.id);
  });

  it('refuses to move into another account’s collection', async () => {
    const item = await createItem();

    const result = await bulk([item.id], { targetCollectionId: foreignCollection.id });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Collection not found or archived.');
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.wishlistId).toBe(source.id);
  });

  it('keeps the category relation in sync through quick edit', async () => {
    const item = await createItem({ category: null });

    const created = await itemActions.quickEditItemAction(
      { success: false },
      formData({
        itemId: item.id,
        wishlistId: source.id,
        title: 'Quick edit',
        priority: 'MEDIUM',
        quantity: '1',
        category: 'Smart Home',
      })
    );
    expect(created.success).toBe(true);

    const category = await prisma.wishlistCategory.findFirstOrThrow({
      where: { wishlistId: source.id, name: 'Smart Home' },
    });
    let stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.wishlistCategoryId).toBe(category.id);

    // Rename the category text: the relation follows the new record.
    await itemActions.quickEditItemAction(
      { success: false },
      formData({
        itemId: item.id,
        wishlistId: source.id,
        title: 'Quick edit',
        priority: 'MEDIUM',
        quantity: '1',
        category: 'Home Automation',
      })
    );
    stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    const renamed = await prisma.wishlistCategory.findFirstOrThrow({
      where: { wishlistId: source.id, name: 'Home Automation' },
    });
    expect(stored.wishlistCategoryId).toBe(renamed.id);

    // Clearing the text clears the relation.
    await itemActions.quickEditItemAction(
      { success: false },
      formData({
        itemId: item.id,
        wishlistId: source.id,
        title: 'Quick edit',
        priority: 'MEDIUM',
        quantity: '1',
        category: '',
      })
    );
    stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.category).toBeNull();
    expect(stored.wishlistCategoryId).toBeNull();
  });

  it('keeps the category relation in sync through the assistant', async () => {
    const item = await createItem({ category: null });
    const assistantTools = await import('@/lib/services/assistant-tools');

    const result = await assistantTools.executeTool(
      userA.id,
      {
        tool: 'update_wishlist_item',
        args: { itemId: item.id, changes: { category: 'Assistant category' } },
      },
      { 'wishlist.update': true, 'wishlist.remove': false, 'wishlist.clear': false }
    );

    expect(result.success).toBe(true);
    const category = await prisma.wishlistCategory.findFirstOrThrow({
      where: { wishlistId: source.id, name: 'Assistant category' },
    });
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.category).toBe('Assistant category');
    expect(stored.wishlistCategoryId).toBe(category.id);
  });

  it('keeps the category relation in sync through the product API', async () => {
    const item = await createItem({ category: null });

    const response = await itemRoute.PATCH(
      new Request(`http://localhost/api/wishlists/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: 'Peripherals' }),
      }),
      { params: Promise.resolve({ id: item.id }) }
    );

    expect(response.status).toBe(200);
    const category = await prisma.wishlistCategory.findFirstOrThrow({
      where: { wishlistId: source.id, name: 'Peripherals' },
    });
    let stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.wishlistCategoryId).toBe(category.id);

    const cleared = await itemRoute.PATCH(
      new Request(`http://localhost/api/wishlists/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: '' }),
      }),
      { params: Promise.resolve({ id: item.id }) }
    );

    expect(cleared.status).toBe(200);
    stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.category).toBeNull();
    expect(stored.wishlistCategoryId).toBeNull();
  });

  it('creates and links a category from the AI organizer', async () => {
    const first = await createItem({ title: 'Organizer one', category: null, position: 0 });
    await createItem({ title: 'Organizer two', category: null, position: 1 });

    const response = await organizeRoute.POST(
      new Request('http://localhost/api/wishlists/organize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wishlistId: source.id,
          mode: 'apply',
          changes: [{ index: 0, action: 'categorize', category: 'Networking' }],
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, applied: 1 });

    const category = await prisma.wishlistCategory.findFirstOrThrow({
      where: { wishlistId: source.id, name: 'Networking' },
    });
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.category).toBe('Networking');
    expect(stored.wishlistCategoryId).toBe(category.id);
  });

  it('remaps the category when the product details dialog moves an item', async () => {
    const sourceCategory = await prisma.wishlistCategory.create({
      data: { wishlistId: source.id, name: 'Audio' },
      select: { id: true },
    });
    const destinationCategory = await prisma.wishlistCategory.create({
      data: { wishlistId: destination.id, name: 'Audio' },
      select: { id: true },
    });
    const item = await createItem({
      category: 'Audio',
      wishlistCategoryId: sourceCategory.id,
    });

    const result = await itemActions.updateItemDetailsAction(
      { success: false },
      formData({
        itemId: item.id,
        wishlistId: source.id,
        title: 'Moved via details',
        category: 'Audio',
        collectionId: destination.id,
        currency: 'USD',
        priority: 'HIGH',
        quantity: '2',
        targetPrice: '199.99',
        notes: 'Keep these notes',
      })
    );

    expect(result.success).toBe(true);
    const moved = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(moved.wishlistId).toBe(destination.id);
    expect(moved.wishlistCategoryId).toBe(destinationCategory.id);
    expect(moved.targetPrice?.toString()).toBe('199.99');
    expect(moved.notes).toBe('Keep these notes');
    expect(moved.metadata).not.toBeNull();
  });

  it('rejects an archived or foreign destination from the details dialog', async () => {
    const item = await createItem();

    for (const collectionId of [archivedCollection.id, foreignCollection.id]) {
      const result = await itemActions.updateItemDetailsAction(
        { success: false },
        formData({
          itemId: item.id,
          wishlistId: source.id,
          title: 'Should not move',
          collectionId,
          currency: 'USD',
          priority: 'MEDIUM',
          quantity: '1',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Collection not found or archived.');
    }

    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.wishlistId).toBe(source.id);
  });

  it('clears the parent relation for composite subfolder labels', async () => {
    const parentCategory = await prisma.wishlistCategory.create({
      data: { wishlistId: source.id, name: 'Audio' },
      select: { id: true },
    });
    const subfolderItem = await createItem({
      title: 'Subfolder item',
      category: 'Audio',
      wishlistCategoryId: parentCategory.id,
    });
    const parentItem = await createItem({
      title: 'Parent item',
      category: 'Audio',
      wishlistCategoryId: parentCategory.id,
      position: 1,
    });

    const { FolderSuggestionService } = await import('@/lib/services/folder-suggestion');
    const service = new FolderSuggestionService({} as never);
    await service.applyFolder(
      {
        wishlistId: source.id,
        itemIds: [subfolderItem.id, parentItem.id],
        folderName: 'Audio',
        subfolders: [{ name: 'Headphones', itemIds: [subfolderItem.id] }],
      },
      userA.id
    );

    const subStored = await prisma.wishlistItem.findUniqueOrThrow({
      where: { id: subfolderItem.id },
    });
    expect(subStored.category).toBe('Audio > Headphones');
    // The composite label has no category record of its own; the relation must
    // not keep pointing at the parent folder.
    expect(subStored.wishlistCategoryId).toBeNull();

    const parentStored = await prisma.wishlistItem.findUniqueOrThrow({
      where: { id: parentItem.id },
    });
    expect(parentStored.category).toBe('Audio');
    const storedParent = await prisma.wishlistCategory.findFirstOrThrow({
      where: { wishlistId: source.id, name: 'Audio' },
    });
    expect(parentStored.wishlistCategoryId).toBe(storedParent.id);
  });
});
