/**
 * Database-level category integrity.
 *
 * A product stores both a free-text category and an optional category record.
 * Application code remaps that relation on every move/edit; the composite
 * foreign key added in `20261119120000_enforce_wishlist_category_integrity`
 * also makes a cross-collection reference impossible at the database layer.
 * These tests exercise the constraint directly, including moves that do not
 * remap the category first.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('database category integrity', () => {
  let prisma: typeof import('@/lib/prisma').prisma;

  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string };
  let collectionB: { id: string };
  let categoryA: { id: string };
  let categoryB: { id: string };
  let itemA: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));

    userA = await prisma.user.create({
      data: {
        email: `cat-a-${suffix}@example.test`,
        username: `cat-a-${suffix}`,
        displayName: 'Category A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `cat-b-${suffix}@example.test`,
        username: `cat-b-${suffix}`,
        displayName: 'Category B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    collectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Category A', slug: `cat-a-${stamp}` },
      select: { id: true },
    });
    collectionB = await prisma.wishlist.create({
      data: { ownerId: userB.id, title: 'Category B', slug: `cat-b-${stamp}` },
      select: { id: true },
    });

    categoryA = await prisma.wishlistCategory.create({
      data: { wishlistId: collectionA.id, name: 'Audio' },
      select: { id: true },
    });
    categoryB = await prisma.wishlistCategory.create({
      data: { wishlistId: collectionB.id, name: 'Audio' },
      select: { id: true },
    });

    itemA = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionA.id,
        title: 'Linked item',
        category: 'Audio',
        wishlistCategoryId: categoryA.id,
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  it('accepts a category from the item’s own collection', async () => {
    const item = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionA.id,
        title: 'Valid category',
        category: 'Audio',
        wishlistCategoryId: categoryA.id,
      },
      select: { id: true, wishlistCategoryId: true },
    });

    expect(item.wishlistCategoryId).toBe(categoryA.id);
  });

  it('rejects creating a product with a category from another collection', async () => {
    await expect(
      prisma.wishlistItem.create({
        data: {
          wishlistId: collectionA.id,
          title: 'Cross-collection create',
          category: 'Audio',
          wishlistCategoryId: categoryB.id,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' });

    expect(await prisma.wishlistItem.count({ where: { title: 'Cross-collection create' } })).toBe(
      0
    );
  });

  it('rejects updating a product to a category from another collection', async () => {
    await expect(
      prisma.wishlistItem.update({
        where: { id: itemA.id },
        data: { wishlistCategoryId: categoryB.id },
      })
    ).rejects.toMatchObject({ code: 'P2003' });

    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: itemA.id } });
    expect(stored.wishlistId).toBe(collectionA.id);
    expect(stored.wishlistCategoryId).toBe(categoryA.id);
  });

  it('rejects a move that leaves the old category relation in place', async () => {
    await expect(
      prisma.wishlistItem.update({
        where: { id: itemA.id },
        data: { wishlistId: collectionB.id },
      })
    ).rejects.toMatchObject({ code: 'P2003' });

    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: itemA.id } });
    expect(stored.wishlistId).toBe(collectionA.id);
    expect(stored.wishlistCategoryId).toBe(categoryA.id);
  });

  it('accepts a move that remaps the category in the same update', async () => {
    const updated = await prisma.wishlistItem.update({
      where: { id: itemA.id },
      data: { wishlistId: collectionB.id, wishlistCategoryId: categoryB.id },
      select: { wishlistId: true, wishlistCategoryId: true },
    });

    expect(updated.wishlistId).toBe(collectionB.id);
    expect(updated.wishlistCategoryId).toBe(categoryB.id);
  });

  it('accepts clearing the category relation', async () => {
    const updated = await prisma.wishlistItem.update({
      where: { id: itemA.id },
      data: { category: null, wishlistCategoryId: null },
      select: { category: true, wishlistCategoryId: true },
    });

    expect(updated.category).toBeNull();
    expect(updated.wishlistCategoryId).toBeNull();
  });

  it('still cascades when a collection with linked categories and products is deleted', async () => {
    await prisma.wishlist.delete({ where: { id: collectionA.id } });

    expect(await prisma.wishlistItem.count({ where: { wishlistId: collectionA.id } })).toBe(0);
    expect(await prisma.wishlistCategory.count({ where: { wishlistId: collectionA.id } })).toBe(0);
  });
});
