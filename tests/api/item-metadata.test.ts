/**
 * Product editor metadata preservation.
 *
 * The full editor submits the metadata fields it owns, but enrichment also
 * stores keys the editor does not expose (`pros`, `cons`, `buyingAdvice`,
 * `fieldConfidence`, and so on). Saving an edit must merge the submitted
 * fields rather than replacing the whole blob.
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

describe.skipIf(!hasDatabase)('item metadata preservation', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let itemRoute: typeof import('@/app/api/wishlists/items/[id]/route');

  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string };
  let itemA: { id: string };

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    itemRoute = await import('@/app/api/wishlists/items/[id]/route');

    userA = await prisma.user.create({
      data: {
        email: `metadata-a-${suffix}@example.test`,
        username: `metadata-a-${suffix}`,
        displayName: 'Metadata A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `metadata-b-${suffix}@example.test`,
        username: `metadata-b-${suffix}`,
        displayName: 'Metadata B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    collectionA = await prisma.wishlist.create({
      data: { ownerId: userA.id, title: 'Metadata A', slug: `metadata-a-${stamp}` },
      select: { id: true },
    });
    itemA = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionA.id,
        title: 'Enriched product',
        category: 'Audio',
        metadata: JSON.stringify({
          pros: ['Great battery'],
          cons: ['Expensive'],
          buyingAdvice: 'Wait for a sale.',
          fieldConfidence: { price: 80 },
          specifications: [{ id: 'old', key: 'Battery', value: '30', unit: 'hours' }],
        }),
      },
      select: { id: true },
    });
    session.user = { id: userA.id, role: 'USER' };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  function patch(metadata: Record<string, unknown>) {
    return itemRoute.PATCH(
      new Request(`http://localhost/api/wishlists/items/${itemA.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Enriched product', metadata }),
      }),
      { params: Promise.resolve({ id: itemA.id }) }
    );
  }

  it('preserves enrichment keys the editor does not submit', async () => {
    const response = await patch({
      specs: [{ id: 'new', key: 'Battery', value: '32', unit: 'hours' }],
      tags: 'audio, wireless',
      model: 'X100',
    });

    expect(response.status).toBe(200);
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: itemA.id } });
    const metadata = JSON.parse(stored.metadata ?? '{}') as Record<string, unknown>;

    expect(metadata.pros).toEqual(['Great battery']);
    expect(metadata.cons).toEqual(['Expensive']);
    expect(metadata.buyingAdvice).toBe('Wait for a sale.');
    expect(metadata.fieldConfidence).toEqual({ price: 80 });

    expect(metadata.specs).toEqual([{ id: 'new', key: 'Battery', value: '32', unit: 'hours' }]);
    expect(metadata.tags).toBe('audio, wireless');
    expect(metadata.model).toBe('X100');
  });

  it('lets an explicitly submitted value replace the stored value', async () => {
    const response = await patch({ tags: '', pros: [] });

    expect(response.status).toBe(200);
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: itemA.id } });
    const metadata = JSON.parse(stored.metadata ?? '{}') as Record<string, unknown>;

    expect(metadata.tags).toBe('');
    expect(metadata.pros).toEqual([]);
    // Untouched keys still survive.
    expect(metadata.cons).toEqual(['Expensive']);
  });

  it('does not let another account edit the metadata', async () => {
    session.user = { id: userB.id, role: 'USER' };

    const response = await patch({ tags: 'hijacked' });

    expect(response.status).toBe(404);
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: itemA.id } });
    const metadata = JSON.parse(stored.metadata ?? '{}') as Record<string, unknown>;
    expect(metadata.tags).toBeUndefined();
    expect(metadata.pros).toEqual(['Great battery']);
  });
});
