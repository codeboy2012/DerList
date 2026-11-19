/**
 * Wishlist-level management: descriptions, colours/icons, archived state and
 * manual ordering.
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

describe.skipIf(!hasDatabase)('wishlist management', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let actions: typeof import('@/app/(app)/wishlists/actions');

  let userA: { id: string };
  let userB: { id: string };
  let first: { id: string };
  let second: { id: string };
  let foreign: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    actions = await import('@/app/(app)/wishlists/actions');

    userA = await prisma.user.create({
      data: {
        email: `manage-a-${suffix}@example.test`,
        username: `manage-a-${suffix}`,
        displayName: 'Manage A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `manage-b-${suffix}@example.test`,
        username: `manage-b-${suffix}`,
        displayName: 'Manage B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    first = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'First', slug: `first-${stamp}` },
      select: { id: true },
    });
    second = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Second', slug: `second-${stamp}` },
      select: { id: true },
    });
    foreign = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: 'Foreign', slug: `foreign-${stamp}` },
      select: { id: true },
    });

    session.user = { id: userA.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  const update = (wishlistId: string, archived?: string) =>
    actions.updateWishlistAction(
      { success: false },
      formData({
        wishlistId,
        title: 'Updated title',
        description: 'Updated description',
        visibility: 'PRIVATE',
        icon: '🎮',
        color: '#22c55e',
        ...(archived === undefined ? {} : { archived }),
      })
    );

  it('saves descriptions, icons and colours', async () => {
    const result = await update(first.id, 'false');
    expect(result.success).toBe(true);

    const stored = await prisma.wishlist.findUnique({ where: { id: first.id } });
    expect(stored?.title).toBe('Updated title');
    expect(stored?.description).toBe('Updated description');
    expect(stored?.icon).toBe('🎮');
    expect(stored?.color).toBe('#22c55e');
    // Regression: the edit form submits archived="false"; it must not archive.
    expect(stored?.archived).toBe(false);
  });

  it('archives only when explicitly requested', async () => {
    const result = await update(first.id, 'true');
    expect(result.success).toBe(true);

    const stored = await prisma.wishlist.findUnique({ where: { id: first.id } });
    expect(stored?.archived).toBe(true);
  });

  it("cannot update another user's wishlist", async () => {
    const result = await update(foreign.id, 'true');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Wishlist not found.');

    const stored = await prisma.wishlist.findUnique({ where: { id: foreign.id } });
    expect(stored?.title).toBe('Foreign');
    expect(stored?.archived).toBe(false);
  });

  it('moves collections up and down with normalised positions', async () => {
    // Isolate from collections left behind by earlier tests in this suite.
    await prisma.wishlist.deleteMany({ where: { ownerId: userA.id } });

    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const a = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Order A', slug: `order-a-${stamp}`, sortOrder: 0 },
      select: { id: true },
    });
    const b = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Order B', slug: `order-b-${stamp}`, sortOrder: 1 },
      select: { id: true },
    });
    const c = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Order C', slug: `order-c-${stamp}`, sortOrder: 2 },
      select: { id: true },
    });

    const ordered = () =>
      prisma.wishlist.findMany({
        where: { ownerId: userA.id },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        select: { id: true, sortOrder: true },
      });

    expect((await ordered()).map((wishlist) => wishlist.id)).toEqual([a.id, b.id, c.id]);

    await actions.moveWishlistAction(formData({ wishlistId: b.id, direction: 'down' }));

    const after = await ordered();
    expect(after.map((wishlist) => wishlist.id)).toEqual([a.id, c.id, b.id]);
    expect(after.map((wishlist) => wishlist.sortOrder)).toEqual([0, 1, 2]);

    await actions.moveWishlistAction(formData({ wishlistId: b.id, direction: 'up' }));

    const restored = await ordered();
    expect(restored.map((wishlist) => wishlist.id)).toEqual([a.id, b.id, c.id]);
  });

  it('does nothing when a collection is already at the edge', async () => {
    const before = await prisma.wishlist.findMany({
      where: { ownerId: userA.id },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, sortOrder: true },
    });

    await actions.moveWishlistAction(
      formData({ wishlistId: before[before.length - 1].id, direction: 'down' })
    );
    await actions.moveWishlistAction(formData({ wishlistId: before[0].id, direction: 'up' }));

    const after = await prisma.wishlist.findMany({
      where: { ownerId: userA.id },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, sortOrder: true },
    });
    expect(after).toEqual(before);
  });

  it("cannot reorder another user's collections", async () => {
    const before = await prisma.wishlist.findMany({
      where: { ownerId: userA.id },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, sortOrder: true },
    });
    const foreignBefore = await prisma.wishlist.findUnique({ where: { id: foreign.id } });

    await actions.moveWishlistAction(formData({ wishlistId: foreign.id, direction: 'up' }));

    const after = await prisma.wishlist.findMany({
      where: { ownerId: userA.id },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, sortOrder: true },
    });
    const foreignAfter = await prisma.wishlist.findUnique({ where: { id: foreign.id } });

    expect(after).toEqual(before);
    expect(foreignAfter?.sortOrder).toBe(foreignBefore?.sortOrder);
  });

  it('keeps the existing archived state when the form omits it', async () => {
    await prisma.wishlist.update({ where: { id: second.id }, data: { archived: true } });

    await actions.updateWishlistAction(
      { success: false },
      formData({
        wishlistId: second.id,
        title: 'Second edited',
        description: '',
        visibility: 'PRIVATE',
        icon: '',
        color: '',
      })
    );

    const stored = await prisma.wishlist.findUnique({ where: { id: second.id } });
    expect(stored?.archived).toBe(true);
  });
});
