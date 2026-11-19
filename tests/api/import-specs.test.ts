/**
 * Imported specifications use the canonical metadata key.
 *
 * Enrichment runs after the import response is sent. This test stubs that
 * background hook and the provider manager, then verifies the stored metadata
 * uses `specs` (never the legacy `specifications` key).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const session: { user: { id: string; role: 'USER' } | null } = { user: null };
const afterTasks = vi.hoisted(() => [] as Array<Promise<unknown>>);

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => session.user,
  requireUser: async () => {
    if (!session.user) throw new Error('requireUser called without a test session');
    return session.user;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (task: () => unknown) => {
      afterTasks.push(Promise.resolve().then(task));
    },
  };
});
vi.mock('@/lib/providers', () => ({
  getProviderManager: () => ({}),
}));
vi.mock('@/lib/services/enrichment', () => ({
  EnrichmentService: class {
    async enrichProduct() {
      return {
        confidence: 90,
        model: 'X100',
        tags: ['audio', 'wireless'],
        specifications: [{ key: 'Battery', value: '30', unit: 'hours' }],
        sellers: [],
        images: [],
      };
    }
  },
}));

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('import specification metadata', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let importPOST: typeof import('@/app/api/wishlists/import/route').POST;

  let user: { id: string };
  let collection: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    importPOST = (await import('@/app/api/wishlists/import/route')).POST;

    user = await prisma.user.create({
      data: {
        email: `import-${suffix}@example.test`,
        username: `import-${suffix}`,
        displayName: 'Import User',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    collection = await prisma.wishlist.create({
      data: { ownerId: user.id, title: 'Import collection', slug: `import-${suffix}` },
      select: { id: true },
    });
    session.user = { id: user.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it('writes specs under the canonical key and never the legacy key', async () => {
    const response = await importPOST(
      new Request('http://localhost/api/wishlists/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wishlistId: collection.id,
          title: 'Imported headphones',
          currency: 'USD',
          skipEnrichment: false,
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { item: { id: string } };

    await Promise.all(afterTasks);

    const stored = await prisma.wishlistItem.findUniqueOrThrow({
      where: { id: payload.item.id },
    });
    const metadata = JSON.parse(stored.metadata ?? '{}') as Record<string, unknown>;

    expect(metadata.enrichmentStatus).toBe('complete');
    expect(metadata.specs).toEqual([
      { id: expect.any(String), key: 'Battery', value: '30', unit: 'hours' },
    ]);
    expect(metadata).not.toHaveProperty('specifications');
    expect(metadata.tags).toBe('audio, wireless');
  });
});
