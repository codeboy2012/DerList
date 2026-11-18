/**
 * Regression tests for the wishlist-item IDOR.
 *
 * These exercise the real Server Action functions against a real PostgreSQL
 * database with two isolated accounts. The previous implementation validated
 * only the submitted `wishlistId`, so an attacker could pair their own
 * collection with a foreign `itemId`; every mutation must now prove that the
 * item belongs to that collection *and* that the collection belongs to the
 * caller.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** The signed-in user returned by the mocked auth helpers. */
const session: { user: { id: string; role: 'USER' } | null } = { user: null };

vi.mock('@/lib/auth', () => ({
  requireUser: async () => {
    if (!session.user) throw new Error('requireUser called without a test session');
    return session.user;
  },
  getCurrentUser: async () => session.user,
}));

// Server Action modules import Next.js runtime helpers; stub them so the
// actions can run outside the framework.
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({ redirect: () => {} }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe.skipIf(!hasDatabase)('wishlist item ownership', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let actions: typeof import('@/app/(app)/wishlists/[id]/item-actions');
  let priorityActions: typeof import('@/app/(app)/wishlists/[id]/priority-action');

  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string };
  let otherCollectionA: { id: string };
  let collectionB: { id: string };
  let itemA: { id: string };
  let itemB: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    actions = await import('@/app/(app)/wishlists/[id]/item-actions');
    priorityActions = await import('@/app/(app)/wishlists/[id]/priority-action');

    userA = await prisma.user.create({
      data: {
        email: `ownership-a-${suffix}@example.test`,
        username: `ownership-a-${suffix}`,
        displayName: 'Ownership A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });

    userB = await prisma.user.create({
      data: {
        email: `ownership-b-${suffix}@example.test`,
        username: `ownership-b-${suffix}`,
        displayName: 'Ownership B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    // Fresh collections and items per test so state cannot leak between cases.
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    collectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'A collection', slug: `a-${stamp}` },
      select: { id: true },
    });
    otherCollectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'A other collection', slug: `a2-${stamp}` },
      select: { id: true },
    });
    collectionB = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: 'B collection', slug: `b-${stamp}` },
      select: { id: true },
    });

    itemA = await prisma.wishlistItem.create({
      data: { wishlistId: collectionA.id, title: 'A item', position: 0 },
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
    // Cascades remove collections, items and sessions for both accounts.
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  it('lets an owner edit their own item', async () => {
    const result = await actions.updateItemAction(
      { success: false },
      formData({
        itemId: itemA.id,
        wishlistId: collectionA.id,
        title: 'A item edited',
        description: '',
        url: '',
        image: '',
        brand: '',
        retailer: '',
        currentPrice: '',
        currency: 'USD',
        priority: 'HIGH',
        quantity: '2',
        notes: '',
      })
    );

    expect(result.success).toBe(true);
    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });
    expect(stored?.title).toBe('A item edited');
    expect(stored?.quantity).toBe(2);
  });

  it('lets an owner delete their own item', async () => {
    await actions.deleteItemAction(formData({ itemId: itemA.id, wishlistId: collectionA.id }));

    await expect(prisma.wishlistItem.findUnique({ where: { id: itemA.id } })).resolves.toBeNull();
  });

  it('lets an owner toggle their own purchased status', async () => {
    await actions.togglePurchasedAction(formData({ itemId: itemA.id, wishlistId: collectionA.id }));

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });
    expect(stored?.purchased).toBe(true);
  });

  it('lets an owner quick-edit their own item', async () => {
    const result = await actions.quickEditItemAction(
      { success: false },
      formData({
        itemId: itemA.id,
        wishlistId: collectionA.id,
        title: 'Quick edited',
        priority: 'CRITICAL',
        quantity: '3',
      })
    );

    expect(result.success).toBe(true);
    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });
    expect(stored?.title).toBe('Quick edited');
    expect(stored?.priority).toBe('CRITICAL');
  });

  it("cannot edit another user's item through the attacker's own collection", async () => {
    const result = await actions.updateItemAction(
      { success: false },
      formData({
        itemId: itemB.id,
        wishlistId: collectionA.id,
        title: 'hijacked',
        description: '',
        url: '',
        image: '',
        brand: '',
        retailer: '',
        currentPrice: '',
        currency: 'USD',
        priority: 'LOW',
        quantity: '1',
        notes: '',
      })
    );

    expect(result.success).toBe(false);
    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(stored?.title).toBe('B item');
  });

  it("cannot delete another user's item through the attacker's own collection", async () => {
    await actions.deleteItemAction(formData({ itemId: itemB.id, wishlistId: collectionA.id }));

    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemB.id } })
    ).resolves.not.toBeNull();
  });

  it("cannot toggle another user's item through the attacker's own collection", async () => {
    await actions.togglePurchasedAction(formData({ itemId: itemB.id, wishlistId: collectionA.id }));

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(stored?.purchased).toBe(false);
  });

  it("cannot quick-edit another user's item through the attacker's own collection", async () => {
    const result = await actions.quickEditItemAction(
      { success: false },
      formData({
        itemId: itemB.id,
        wishlistId: collectionA.id,
        title: 'hijacked',
        priority: 'LOW',
        quantity: '1',
      })
    );

    expect(result.success).toBe(false);
    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(stored?.title).toBe('B item');
  });

  it('rejects an item from another of the same user\u2019s collections', async () => {
    const result = await actions.updateItemAction(
      { success: false },
      formData({
        itemId: itemA.id,
        wishlistId: otherCollectionA.id,
        title: 'moved by mismatch',
        description: '',
        url: '',
        image: '',
        brand: '',
        retailer: '',
        currentPrice: '',
        currency: 'USD',
        priority: 'LOW',
        quantity: '1',
        notes: '',
      })
    );

    expect(result.success).toBe(false);

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });
    expect(stored?.title).toBe('A item');
    expect(stored?.wishlistId).toBe(collectionA.id);
  });

  it('does not delete an item when the collection does not contain it', async () => {
    await actions.deleteItemAction(formData({ itemId: itemA.id, wishlistId: otherCollectionA.id }));

    await expect(
      prisma.wishlistItem.findUnique({ where: { id: itemA.id } })
    ).resolves.not.toBeNull();
  });

  it('does not change purchased state when the collection does not contain the item', async () => {
    await actions.togglePurchasedAction(
      formData({ itemId: itemA.id, wishlistId: otherCollectionA.id })
    );

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });
    expect(stored?.purchased).toBe(false);
  });

  it('lets an owner set the star priority of their own item', async () => {
    await priorityActions.updateStarPriorityAction(
      formData({ itemId: itemA.id, wishlistId: collectionA.id, starPriority: '3' })
    );

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });
    expect(stored?.starPriority).toBe(3);
  });

  it("cannot set star priority on another user's item through the attacker's own collection", async () => {
    await priorityActions.updateStarPriorityAction(
      formData({ itemId: itemB.id, wishlistId: collectionA.id, starPriority: '4' })
    );

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(stored?.starPriority).toBe(1);
  });
});
