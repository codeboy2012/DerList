/**
 * Product archive behaviour.
 *
 * Archiving hides a product without deleting it: metadata, notes, source URL
 * and the product link survive, and restoring brings the item back.
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

describe.skipIf(!hasDatabase)('product archive', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let actions: typeof import('@/app/(app)/wishlists/[id]/bulk-actions');

  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string };
  let collectionB: { id: string };
  let itemA: { id: string };
  let itemB: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    actions = await import('@/app/(app)/wishlists/[id]/bulk-actions');

    userA = await prisma.user.create({
      data: {
        email: `archive-a-${suffix}@example.test`,
        username: `archive-a-${suffix}`,
        displayName: 'Archive A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `archive-b-${suffix}@example.test`,
        username: `archive-b-${suffix}`,
        displayName: 'Archive B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    collectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Archive A', slug: `archive-a-${stamp}` },
      select: { id: true },
    });
    collectionB = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: 'Archive B', slug: `archive-b-${stamp}` },
      select: { id: true },
    });

    itemA = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionA.id,
        title: 'Archived speaker',
        notes: 'Keep the receipt',
        url: 'https://example.com/speaker',
        targetPrice: 99.5,
        metadata: JSON.stringify({ tags: 'audio' }),
        position: 0,
      },
      select: { id: true },
    });
    itemB = await prisma.wishlistItem.create({
      data: { wishlistId: collectionB.id, title: 'B speaker', position: 0 },
      select: { id: true },
    });

    session.user = { id: userA.id, role: 'USER' };
    await actions.archiveItemAction(formData({ itemId: itemA.id, wishlistId: collectionA.id }));
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  it('sets the archive state without touching product data', async () => {
    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });

    expect(stored?.archived).toBe(true);
    expect(stored?.archivedAt).toBeInstanceOf(Date);
    expect(stored?.title).toBe('Archived speaker');
    expect(stored?.notes).toBe('Keep the receipt');
    expect(stored?.url).toBe('https://example.com/speaker');
    expect(stored?.metadata).toBe(JSON.stringify({ tags: 'audio' }));
    expect(stored?.targetPrice?.toString()).toBe('99.5');
  });

  it('excludes archived products from normal views but keeps them searchable in the archive', async () => {
    const active = await prisma.wishlistItem.findMany({
      where: { wishlistId: collectionA.id, archived: false },
    });
    expect(active).toHaveLength(0);

    const archived = await prisma.wishlistItem.findMany({
      where: {
        wishlistId: collectionA.id,
        archived: true,
        title: { contains: 'speaker', mode: 'insensitive' },
      },
    });
    expect(archived.map((item) => item.id)).toEqual([itemA.id]);

    const categoryFiltered = await prisma.wishlistItem.findMany({
      where: { wishlistId: collectionA.id, archived: true, category: 'Audio' },
    });
    expect(categoryFiltered).toHaveLength(0);
  });

  it('restores an archived product', async () => {
    await actions.restoreItemAction(formData({ itemId: itemA.id, wishlistId: collectionA.id }));

    const stored = await prisma.wishlistItem.findUnique({ where: { id: itemA.id } });
    expect(stored?.archived).toBe(false);
    expect(stored?.archivedAt).toBeNull();

    const active = await prisma.wishlistItem.findMany({
      where: { wishlistId: collectionA.id, archived: false },
    });
    expect(active.map((item) => item.id)).toContain(itemA.id);
  });

  it('permanently deletes an archived product', async () => {
    await actions.deleteArchivedItemAction(
      formData({ itemId: itemA.id, wishlistId: collectionA.id })
    );

    await expect(prisma.wishlistItem.findUnique({ where: { id: itemA.id } })).resolves.toBeNull();
  });

  it("cannot archive, restore or delete another user's product", async () => {
    await actions.archiveItemAction(formData({ itemId: itemA.id, wishlistId: collectionA.id }));

    await actions.restoreItemAction(formData({ itemId: itemB.id, wishlistId: collectionA.id }));
    await actions.deleteArchivedItemAction(
      formData({ itemId: itemB.id, wishlistId: collectionB.id })
    );

    const foreign = await prisma.wishlistItem.findUnique({ where: { id: itemB.id } });
    expect(foreign).not.toBeNull();
    expect(foreign?.wishlistId).toBe(collectionB.id);
  });
});
