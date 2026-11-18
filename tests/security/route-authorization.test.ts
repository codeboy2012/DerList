/**
 * Authorization regression tests for the private-read endpoints.
 *
 * Covers the three marketplace-era leaks fixed in this milestone:
 * - top-picks was readable for PUBLIC/UNLISTED lists by anyone;
 * - copy allowed copying another user's non-private list;
 * - uploads were served anonymously.
 */
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

describe.skipIf(!hasDatabase)('private route authorization', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let topPicksGET: typeof import('@/app/api/wishlists/[id]/top-picks/route').GET;
  let copyPOST: typeof import('@/app/api/wishlists/copy/route').POST;
  let uploadsGET: typeof import('@/app/uploads/[...path]/route').GET;

  let userA: { id: string };
  let userB: { id: string };
  let collectionB: { id: string };
  let uploadDir: string;

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `probe-${suffix}.png`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));

    uploadDir = await mkdtemp(join(tmpdir(), 'derlist-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    await writeFile(join(uploadDir, storagePath), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    topPicksGET = (await import('@/app/api/wishlists/[id]/top-picks/route')).GET;
    copyPOST = (await import('@/app/api/wishlists/copy/route')).POST;
    uploadsGET = (await import('@/app/uploads/[...path]/route')).GET;

    userA = await prisma.user.create({
      data: {
        email: `routes-a-${suffix}@example.test`,
        username: `routes-a-${suffix}`,
        displayName: 'Routes A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });

    userB = await prisma.user.create({
      data: {
        email: `routes-b-${suffix}@example.test`,
        username: `routes-b-${suffix}`,
        displayName: 'Routes B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });

    collectionB = await prisma.wishlist.create({
      data: {
        ownerId: userB.id,
        title: 'B collection',
        slug: `b-${suffix}`,
        visibility: 'PUBLIC', // legacy row — must still be private in behaviour
        topPicks: [{ position: 1, itemId: 'demo' }],
      },
      select: { id: true },
    });

    await prisma.media.create({
      data: {
        originalName: 'probe.png',
        filename: storagePath,
        mimeType: 'image/png',
        size: 4,
        storagePath,
        uploadedById: userB.id,
        purpose: 'product_image',
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
  });

  function context(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it('returns 404 for another user\u2019s top picks, even on a legacy PUBLIC row', async () => {
    session.user = { id: userA.id, role: 'USER' };

    const response = await topPicksGET(
      new Request('http://localhost/api'),
      context(collectionB.id)
    );
    expect(response.status).toBe(404);
  });

  it('returns top picks to their owner', async () => {
    session.user = { id: userB.id, role: 'USER' };

    const response = await topPicksGET(
      new Request('http://localhost/api'),
      context(collectionB.id)
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      topPicks: [{ position: 1, itemId: 'demo' }],
    });
  });

  it('returns 404 for unauthenticated top-picks requests', async () => {
    session.user = null;

    const response = await topPicksGET(
      new Request('http://localhost/api'),
      context(collectionB.id)
    );
    expect(response.status).toBe(404);
  });

  it('refuses to copy another user\u2019s collection and creates nothing', async () => {
    session.user = { id: userA.id, role: 'USER' };

    const response = await copyPOST(
      new Request('http://localhost/api/wishlists/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceWishlistId: collectionB.id }),
      })
    );

    expect(response.status).toBe(404);
    await expect(prisma.wishlist.count({ where: { ownerId: userA.id } })).resolves.toBe(0);
  });

  it('allows an owner to copy their own collection', async () => {
    session.user = { id: userB.id, role: 'USER' };

    const response = await copyPOST(
      new Request('http://localhost/api/wishlists/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceWishlistId: collectionB.id, name: `B copy ${suffix}` }),
      })
    );

    expect(response.status).toBe(200);
    await expect(prisma.wishlist.count({ where: { ownerId: userB.id } })).resolves.toBe(2);
  });

  it('does not serve an upload to another account', async () => {
    session.user = { id: userA.id, role: 'USER' };

    const response = await uploadsGET(new Request(`http://localhost/uploads/${storagePath}`), {
      params: Promise.resolve({ path: [storagePath] }),
    });

    expect(response.status).toBe(404);
  });

  it('does not serve an upload anonymously', async () => {
    session.user = null;

    const response = await uploadsGET(new Request(`http://localhost/uploads/${storagePath}`), {
      params: Promise.resolve({ path: [storagePath] }),
    });

    expect(response.status).toBe(404);
  });

  it('serves an upload to its owner with a private cache header', async () => {
    session.user = { id: userB.id, role: 'USER' };

    const response = await uploadsGET(new Request(`http://localhost/uploads/${storagePath}`), {
      params: Promise.resolve({ path: [storagePath] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('content-type')).toBe('image/png');
  });

  it('refuses traversal attempts', async () => {
    session.user = { id: userB.id, role: 'USER' };

    const response = await uploadsGET(new Request('http://localhost/uploads/..%2Fsecret'), {
      params: Promise.resolve({ path: ['..', 'secret'] }),
    });

    expect(response.status).toBe(403);
  });
});
