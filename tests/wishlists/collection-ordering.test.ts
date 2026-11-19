/**
 * Collection ordering with mixed active/archived collections.
 *
 * The active and archived lists are separate views; reordering one must not
 * disturb the other's positions.
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
vi.mock('next/navigation', () => ({ redirect: () => {} }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe.skipIf(!hasDatabase)('collection ordering', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let actions: typeof import('@/app/(app)/wishlists/actions');

  let user: { id: string };
  let first: { id: string };
  let second: { id: string };
  let archived: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    actions = await import('@/app/(app)/wishlists/actions');

    user = await prisma.user.create({
      data: {
        email: `order-${suffix}@example.test`,
        username: `order-${suffix}`,
        displayName: 'Order User',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Each case starts from a clean collection set.
    await prisma.wishlist.deleteMany({ where: { ownerId: user.id } });

    first = await prisma.wishlist.create({
      data: { ownerId: user.id, title: 'First active', slug: `order-1-${stamp}`, sortOrder: 0 },
      select: { id: true },
    });
    second = await prisma.wishlist.create({
      data: { ownerId: user.id, title: 'Second active', slug: `order-2-${stamp}`, sortOrder: 1 },
      select: { id: true },
    });
    archived = await prisma.wishlist.create({
      data: {
        ownerId: user.id,
        title: 'Archived collection',
        slug: `order-arch-${stamp}`,
        sortOrder: 0,
        archived: true,
      },
      select: { id: true },
    });

    session.user = { id: user.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it('reorders active collections without disturbing archived ones', async () => {
    await actions.moveWishlistAction(formData({ wishlistId: second.id, direction: 'up' }));

    const active = await prisma.wishlist.findMany({
      where: { ownerId: user.id, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, sortOrder: true },
    });
    expect(active.map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(active.map((entry) => entry.sortOrder)).toEqual([0, 1]);

    const archivedCollection = await prisma.wishlist.findUniqueOrThrow({
      where: { id: archived.id },
    });
    expect(archivedCollection.sortOrder).toBe(0);
  });

  it('ignores moves that would leave the collection’s own list', async () => {
    // First active collection cannot move up past the start of its own list.
    await actions.moveWishlistAction(formData({ wishlistId: first.id, direction: 'up' }));

    const active = await prisma.wishlist.findMany({
      where: { ownerId: user.id, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true },
    });
    expect(active.map((entry) => entry.id)).toEqual([first.id, second.id]);
  });
});
