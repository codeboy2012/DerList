/**
 * Account export completeness.
 *
 * The export must be lossless for stored data: archive state, archive date,
 * extended metadata, category relationships and every persisted item field.
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

const hasDatabase = Boolean(process.env.DATABASE_URL);

interface ExportedItem {
  id: string;
  wishlistCategoryId: string | null;
  category: string | null;
  model: string | null;
  condition: string | null;
  availability: string | null;
  targetPrice: string | null;
  dealInfo: string | null;
  productId: string | null;
  archived: boolean;
  archivedAt: string | null;
  position: number;
  metadata: Record<string, unknown> | string | null;
}

describe.skipIf(!hasDatabase)('account export', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let exportGET: typeof import('@/app/api/account/export/route').GET;

  let userA: { id: string };
  let userB: { id: string };
  let collection: { id: string };
  let category: { id: string };
  let product: { id: string };
  const productIds: string[] = [];
  let collectionSlug: string;
  let activeItem: { id: string };
  let archivedItem: { id: string };
  let metadata: string;
  let archivedAt: Date;

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    exportGET = (await import('@/app/api/account/export/route')).GET;

    userA = await prisma.user.create({
      data: {
        email: `export-a-${suffix}@example.test`,
        username: `export-a-${suffix}`,
        displayName: 'Export A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `export-b-${suffix}@example.test`,
        username: `export-b-${suffix}`,
        displayName: 'Export B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    archivedAt = new Date();
    metadata = JSON.stringify({
      tags: 'wireless, audio',
      specs: [{ id: '1', key: 'Battery', value: '30', unit: 'hours' }],
      sellers: [{ id: 's1', name: 'Store', price: '249.99' }],
    });

    collectionSlug = `export-${stamp}`;
    collection = await prisma.wishlist.create({
      data: {
        ownerId: userA.id,
        title: `Export collection ${stamp}`,
        description: 'Export description',
        slug: collectionSlug,
        icon: '🎧',
        color: '#3b82f6',
        notice: 'Export notice',
        sortOrder: 4,
        topPicks: [{ position: 1, itemId: 'demo' }],
      },
      select: { id: true },
    });

    await prisma.wishlist.create({
      data: { ownerId: userB.id, title: `Foreign collection ${stamp}`, slug: `export-b-${stamp}` },
    });

    category = await prisma.wishlistCategory.create({
      data: {
        wishlistId: collection.id,
        name: 'Audio',
        description: 'Sound gear',
        notes: 'Category notes',
        externalLink: 'https://example.com/build',
        externalLinkLabel: 'Build',
        icon: '🔊',
        sortOrder: 2,
      },
      select: { id: true },
    });

    product = await prisma.product.create({
      data: { title: `Exported product ${stamp}`, currency: 'USD' },
      select: { id: true },
    });
    productIds.push(product.id);

    activeItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collection.id,
        title: 'Active headphones',
        description: 'Active description',
        notes: 'Active notes',
        url: 'https://example.com/active',
        image: 'https://example.com/active.jpg',
        brand: 'Example Audio',
        model: 'X100',
        condition: 'New',
        availability: 'In stock',
        retailer: 'Example Store',
        currentPrice: 249.99,
        targetPrice: 199.99,
        originalPrice: 299.99,
        dealInfo: 'Active deal',
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
      select: { id: true },
    });

    archivedItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collection.id,
        title: 'Archived headphones',
        notes: 'Archived notes',
        category: 'Audio',
        wishlistCategoryId: category.id,
        position: 1,
        archived: true,
        archivedAt,
        metadata,
      },
      select: { id: true },
    });

    session.user = { id: userA.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  });

  it('exports archive state, metadata and every stored item field', async () => {
    const response = await exportGET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const payload = (await response.json()) as {
      account: { id: string };
      collections: Array<{
        id: string;
        slug: string;
        notice: string | null;
        sortOrder: number;
        topPicks: unknown;
        categories: Array<{ id: string; icon: string | null }>;
        items: ExportedItem[];
      }>;
    };

    expect(payload.account.id).toBe(userA.id);

    const exported = payload.collections[0];
    expect(exported.id).toBe(collection.id);
    expect(exported.slug).toBe(collectionSlug);
    expect(exported.notice).toBe('Export notice');
    expect(exported.sortOrder).toBe(4);
    expect(exported.topPicks).toEqual([{ position: 1, itemId: 'demo' }]);
    expect(exported.categories[0].id).toBe(category.id);
    expect(exported.categories[0].icon).toBe('🔊');

    expect(exported.items).toHaveLength(2);
    const active = exported.items.find((item) => item.id === activeItem.id)!;
    const archived = exported.items.find((item) => item.id === archivedItem.id)!;

    expect(active.archived).toBe(false);
    expect(active.archivedAt).toBeNull();
    expect(active.model).toBe('X100');
    expect(active.condition).toBe('New');
    expect(active.availability).toBe('In stock');
    expect(active.targetPrice).toBe('199.99');
    expect(active.dealInfo).toBe('Active deal');
    expect(active.productId).toBe(product.id);
    expect(active.wishlistCategoryId).toBe(category.id);
    expect(active.category).toBe('Audio');
    expect(active.position).toBe(0);
    expect(active.metadata).toEqual(JSON.parse(metadata));

    expect(archived.archived).toBe(true);
    expect(archived.archivedAt).toBe(archivedAt.toISOString());
    expect(archived.metadata).toEqual(JSON.parse(metadata));
    expect(archived.wishlistCategoryId).toBe(category.id);
    expect(archived.position).toBe(1);
  });

  it('does not export another account’s data', async () => {
    session.user = { id: userB.id, role: 'USER' };

    const response = await exportGET();
    const payload = (await response.json()) as {
      collections: Array<{ id: string; items: unknown[] }>;
    };

    // Only rows owned by userB are returned; the userA collection is absent.
    expect(payload.collections.length).toBeGreaterThan(0);
    expect(payload.collections.every((entry) => entry.id !== collection.id)).toBe(true);
    expect(payload.collections.every((entry) => entry.items.length === 0)).toBe(true);
  });

  it('rejects unauthenticated exports', async () => {
    session.user = null;

    const response = await exportGET();

    expect(response.status).toBe(401);
  });
});
