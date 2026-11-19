/**
 * Wishlist duplication.
 *
 * A duplicate must contain independent wishlist-item records that preserve the
 * source data, including category relationships, without exposing another
 * account's collection.
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
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe.skipIf(!hasDatabase)('wishlist duplication', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let actions: typeof import('@/app/(app)/wishlists/actions');
  let redirectMock: ReturnType<typeof vi.fn>;

  let userA: { id: string };
  let userB: { id: string };
  let source: { id: string };
  let foreignSource: { id: string };
  let category: { id: string };
  let product: { id: string };
  let sourceTitle: string;

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    actions = await import('@/app/(app)/wishlists/actions');
    const navigation = await import('next/navigation');
    redirectMock = vi.mocked(navigation.redirect) as unknown as ReturnType<typeof vi.fn>;

    userA = await prisma.user.create({
      data: {
        email: `dup-a-${suffix}@example.test`,
        username: `dup-a-${suffix}`,
        displayName: 'Duplicate A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `dup-b-${suffix}@example.test`,
        username: `dup-b-${suffix}`,
        displayName: 'Duplicate B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sourceTitle = `Source ${stamp}`;

    source = await prisma.wishlist.create({
      data: {
        ownerId: userA.id,
        title: sourceTitle,
        slug: `source-${stamp}`,
        description: 'Source description',
        icon: '🎧',
        color: '#3b82f6',
        notice: 'A notice',
      },
      select: { id: true },
    });
    foreignSource = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: `Foreign ${stamp}`, slug: `foreign-${stamp}` },
      select: { id: true },
    });

    category = await prisma.wishlistCategory.create({
      data: {
        wishlistId: source.id,
        name: 'Audio',
        description: 'Sound gear',
        icon: '🔊',
        sortOrder: 2,
      },
      select: { id: true },
    });

    product = await prisma.product.create({
      data: { title: 'Shared product', currency: 'USD' },
      select: { id: true },
    });

    await prisma.wishlistItem.create({
      data: {
        wishlistId: source.id,
        title: 'Studio headphones',
        notes: 'Wait for a sale',
        url: 'https://example.com/headphones',
        brand: 'Brand',
        model: 'X100',
        condition: 'New',
        retailer: 'Example',
        currentPrice: 249.99,
        targetPrice: 199.99,
        originalPrice: 299.99,
        dealInfo: 'Deal',
        priority: 'HIGH',
        starPriority: 3,
        quantity: 2,
        availability: 'In stock',
        category: 'Audio',
        wishlistCategoryId: category.id,
        position: 0,
        productId: product.id,
        metadata: JSON.stringify({ tags: 'audio' }),
      },
    });

    // Archived products are not part of the normal collection view.
    await prisma.wishlistItem.create({
      data: {
        wishlistId: source.id,
        title: 'Archived product',
        position: 1,
        archived: true,
        archivedAt: new Date(),
      },
    });

    session.user = { id: userA.id, role: 'USER' };
    redirectMock.mockClear();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    if (product) await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  it('creates independent item records that preserve product information', async () => {
    await actions.duplicateWishlistAction(formData({ wishlistId: source.id }));

    const copy = await prisma.wishlist.findFirst({
      where: { ownerId: userA.id, title: `${sourceTitle} (Copy)` },
      include: { items: true, categories: true },
    });

    expect(copy).not.toBeNull();
    expect(copy?.description).toBe('Source description');
    expect(copy?.icon).toBe('🎧');
    expect(copy?.color).toBe('#3b82f6');
    expect(copy?.notice).toBe('A notice');
    expect(copy?.archived).toBe(false);

    const sourceItems = await prisma.wishlistItem.findMany({
      where: { wishlistId: source.id, archived: false },
    });
    expect(copy?.items).toHaveLength(1);
    expect(copy?.items[0].id).not.toBe(sourceItems[0].id);

    const copied = copy!.items[0];
    expect(copied.title).toBe('Studio headphones');
    expect(copied.notes).toBe('Wait for a sale');
    expect(copied.url).toBe('https://example.com/headphones');
    expect(copied.brand).toBe('Brand');
    expect(copied.model).toBe('X100');
    expect(copied.condition).toBe('New');
    expect(copied.retailer).toBe('Example');
    expect(copied.currentPrice?.toString()).toBe('249.99');
    expect(copied.targetPrice?.toString()).toBe('199.99');
    expect(copied.originalPrice?.toString()).toBe('299.99');
    expect(copied.priority).toBe('HIGH');
    expect(copied.starPriority).toBe(3);
    expect(copied.quantity).toBe(2);
    expect(copied.category).toBe('Audio');
    expect(copied.metadata).toBe(JSON.stringify({ tags: 'audio' }));
    expect(copied.productId).toBe(product.id);

    expect(copy?.categories).toHaveLength(1);
    expect(copy?.categories[0].id).not.toBe(category.id);
    expect(copy?.categories[0].name).toBe('Audio');
    expect(copy?.categories[0].description).toBe('Sound gear');
    expect(copied.wishlistCategoryId).toBe(copy?.categories[0].id);

    // Archived products stay in the source collection.
    const copyArchived = await prisma.wishlistItem.count({
      where: { wishlistId: copy!.id, archived: true },
    });
    expect(copyArchived).toBe(0);
  });

  it('redirects to the new copy', async () => {
    await actions.duplicateWishlistAction(formData({ wishlistId: source.id }));

    expect(redirectMock).toHaveBeenCalledTimes(1);
    const destination = String(redirectMock.mock.calls[0][0]);
    expect(destination).toMatch(/^\/wishlists\/[a-z0-9]+$/);

    const copyId = destination.split('/').pop();
    await expect(
      prisma.wishlist.findFirst({ where: { id: copyId, ownerId: userA.id } })
    ).resolves.not.toBeNull();
  });

  it("does not duplicate another user's wishlist", async () => {
    const before = await prisma.wishlist.count({ where: { ownerId: userA.id } });

    await actions.duplicateWishlistAction(formData({ wishlistId: foreignSource.id }));

    expect(await prisma.wishlist.count({ where: { ownerId: userA.id } })).toBe(before);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
