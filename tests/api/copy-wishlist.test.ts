/**
 * Copy API behaviour.
 *
 * The header Copy dialog must produce the same complete copy as the full
 * duplication action: every stored item field, category relationships, honouring
 * `copyTags`/`copyMetadata` independently, and never including archived items.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const session: { user: { id: string; role: 'USER' } | null } = { user: null };

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => session.user,
  requireUser: async () => {
    if (!session.user) throw new Error('requireUser called without a test session');
    return session.user;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('copy wishlist API', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let copyPOST: typeof import('@/app/api/wishlists/copy/route').POST;

  let userA: { id: string };
  let userB: { id: string };
  let source: { id: string };
  let category: { id: string };
  let product: { id: string };
  const productIds: string[] = [];
  let metadata: string;

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    copyPOST = (await import('@/app/api/wishlists/copy/route')).POST;

    userA = await prisma.user.create({
      data: {
        email: `copy-a-${suffix}@example.test`,
        username: `copy-a-${suffix}`,
        displayName: 'Copy A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `copy-b-${suffix}@example.test`,
        username: `copy-b-${suffix}`,
        displayName: 'Copy B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    metadata = JSON.stringify({
      tags: 'audio, wireless',
      aiTags: 'headphones',
      specs: [{ id: '1', key: 'Battery', value: '30', unit: 'hours' }],
      sellers: [{ id: 's1', name: 'Store', price: '249.99' }],
    });

    source = await prisma.wishlist.create({
      data: {
        ownerId: userA.id,
        title: `Copy source ${stamp}`,
        description: 'Source description',
        slug: `copy-src-${stamp}`,
        icon: '🎧',
        color: '#3b82f6',
        notice: 'Copy notice',
      },
      select: { id: true },
    });
    category = await prisma.wishlistCategory.create({
      data: {
        wishlistId: source.id,
        name: 'Audio',
        description: 'Sound gear',
        externalLink: 'https://example.com/build',
        externalLinkLabel: 'Build',
        notes: 'Category notes',
        sortOrder: 2,
        icon: '🔊',
      },
      select: { id: true },
    });

    product = await prisma.product.create({
      data: { title: `Copied product ${stamp}`, currency: 'USD' },
      select: { id: true },
    });
    productIds.push(product.id);

    await prisma.wishlistItem.create({
      data: {
        wishlistId: source.id,
        title: 'Studio headphones',
        description: 'Closed-back',
        notes: 'Wait for a sale',
        url: 'https://example.com/headphones',
        image: 'https://example.com/headphones.jpg',
        brand: 'Example Audio',
        model: 'X100',
        condition: 'New',
        availability: 'In stock',
        retailer: 'Example Store',
        currentPrice: 249.99,
        targetPrice: 199.99,
        originalPrice: 299.99,
        dealInfo: 'Deal',
        currency: 'USD',
        priority: 'HIGH',
        starPriority: 3,
        quantity: 2,
        category: 'Audio',
        wishlistCategoryId: category.id,
        position: 0,
        productId: product.id,
        metadata,
      },
    });

    await prisma.wishlistItem.create({
      data: {
        wishlistId: source.id,
        title: 'Archived product',
        archived: true,
        archivedAt: new Date(),
        position: 1,
      },
    });

    session.user = { id: userA.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  });

  function request(body: Record<string, unknown>) {
    return copyPOST(
      new Request('http://localhost/api/wishlists/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
  }

  /** Run a create-copy request and load exactly the row it created. */
  async function copyRequest(body: Record<string, unknown>) {
    const response = await request({ ...body, name: 'Copied collection' });
    const payload = (await response.json()) as { wishlist?: { id: string } };
    if (!payload.wishlist) throw new Error('Copy response did not include a wishlist id');

    const copy = await prisma.wishlist.findFirstOrThrow({
      where: { id: payload.wishlist.id, ownerId: userA.id },
      include: { items: true, categories: true },
    });
    return { response, copy };
  }

  it('copies every item field, category relationship and metadata by default', async () => {
    const { response, copy } = await copyRequest({ sourceWishlistId: source.id });
    expect(response.status).toBe(200);
    expect(copy).not.toBeNull();
    expect(copy.description).toBe('Source description');
    expect(copy.icon).toBe('🎧');
    expect(copy.color).toBe('#3b82f6');
    expect(copy.notice).toBe('Copy notice');
    expect(copy.archived).toBe(false);
    expect(copy.items).toHaveLength(1);
    expect(copy.categories).toHaveLength(1);

    const copied = copy.items[0];
    expect(copied.title).toBe('Studio headphones');
    expect(copied.description).toBe('Closed-back');
    expect(copied.notes).toBe('Wait for a sale');
    expect(copied.url).toBe('https://example.com/headphones');
    expect(copied.image).toBe('https://example.com/headphones.jpg');
    expect(copied.brand).toBe('Example Audio');
    expect(copied.model).toBe('X100');
    expect(copied.condition).toBe('New');
    expect(copied.availability).toBe('In stock');
    expect(copied.retailer).toBe('Example Store');
    expect(copied.currentPrice?.toString()).toBe('249.99');
    expect(copied.targetPrice?.toString()).toBe('199.99');
    expect(copied.originalPrice?.toString()).toBe('299.99');
    expect(copied.dealInfo).toBe('Deal');
    expect(copied.priority).toBe('HIGH');
    expect(copied.starPriority).toBe(3);
    expect(copied.quantity).toBe(2);
    expect(copied.productId).toBe(product.id);
    expect(copied.metadata).toBe(metadata);
    expect(copied.category).toBe('Audio');

    expect(copy.categories[0].id).not.toBe(category.id);
    expect(copy.categories[0].name).toBe('Audio');
    expect(copy.categories[0].description).toBe('Sound gear');
    expect(copy.categories[0].externalLink).toBe('https://example.com/build');
    expect(copy.categories[0].notes).toBe('Category notes');
    expect(copy.categories[0].icon).toBe('🔊');
    expect(copied.wishlistCategoryId).toBe(copy.categories[0].id);

    // Archived products stay in the source collection.
    expect(
      await prisma.wishlistItem.count({ where: { wishlistId: copy.id, archived: true } })
    ).toBe(0);
  });

  it('drops tags but keeps metadata when copyTags is false', async () => {
    const { copy } = await copyRequest({
      sourceWishlistId: source.id,
      copyTags: false,
      copyMetadata: true,
    });

    const parsed = JSON.parse(copy!.items[0].metadata ?? '{}') as Record<string, unknown>;
    expect(parsed.tags).toBeUndefined();
    expect(parsed.aiTags).toBeUndefined();
    expect(parsed.specs).toEqual([{ id: '1', key: 'Battery', value: '30', unit: 'hours' }]);
    expect(parsed.sellers).toBeDefined();
  });

  it('keeps tags but drops metadata when copyMetadata is false', async () => {
    const { copy } = await copyRequest({
      sourceWishlistId: source.id,
      copyTags: true,
      copyMetadata: false,
    });

    const parsed = JSON.parse(copy!.items[0].metadata ?? '{}') as Record<string, unknown>;
    expect(parsed.tags).toBe('audio, wireless');
    expect(parsed.aiTags).toBe('headphones');
    expect(parsed.specs).toBeUndefined();
    expect(parsed.sellers).toBeUndefined();
  });

  it('omits metadata entirely when both metadata and tags are disabled', async () => {
    const { copy } = await copyRequest({
      sourceWishlistId: source.id,
      copyTags: false,
      copyMetadata: false,
    });

    expect(copy!.items[0].metadata).toBeNull();
  });

  it('keeps the category text but clears the relation when categories are excluded', async () => {
    const { copy } = await copyRequest({
      sourceWishlistId: source.id,
      copyCategories: false,
    });

    expect(copy!.categories).toHaveLength(0);
    expect(copy.items[0].category).toBe('Audio');
    expect(copy.items[0].wishlistCategoryId).toBeNull();
  });

  it('creates independent item and category records', async () => {
    const { copy } = await copyRequest({ sourceWishlistId: source.id });

    const sourceItems = await prisma.wishlistItem.findMany({
      where: { wishlistId: source.id, archived: false },
    });
    expect(copy!.items[0].id).not.toBe(sourceItems[0].id);
    expect(copy!.categories[0].id).not.toBe(category.id);
    // The shared Product record may be referenced by both entries.
    expect(copy!.items[0].productId).toBe(sourceItems[0].productId);
  });

  it('does not copy another account’s collection', async () => {
    session.user = { id: userB.id, role: 'USER' };
    const beforeB = await prisma.wishlist.count({ where: { ownerId: userB.id } });
    const beforeA = await prisma.wishlist.count({ where: { ownerId: userA.id } });

    const response = await request({ sourceWishlistId: source.id, name: 'Hijacked copy' });

    expect(response.status).toBe(404);
    expect(await prisma.wishlist.count({ where: { ownerId: userB.id } })).toBe(beforeB);
    expect(await prisma.wishlist.count({ where: { ownerId: userA.id } })).toBe(beforeA);
  });

  it('rejects unauthenticated copy requests', async () => {
    session.user = null;

    const response = await request({ sourceWishlistId: source.id });

    expect(response.status).toBe(401);
  });
});
