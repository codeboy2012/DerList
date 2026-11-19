/**
 * Cross-account metadata privacy.
 *
 * `generateMetadata` runs outside the page's `notFound()` guard, so its lookup
 * must be owner-scoped. A foreign collection may render "Page not found" while
 * still leaking its title through the document metadata if the lookup is by id
 * alone.
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

describe.skipIf(!hasDatabase)('wishlist metadata privacy', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let detailMetadata: typeof import('@/app/(app)/wishlists/[id]/page').generateMetadata;
  let editMetadata: typeof import('@/app/(app)/wishlists/[id]/edit/page').generateMetadata;
  let metadataTitle: typeof import('@/lib/wishlists/metadata').wishlistMetadataTitle;

  let userA: { id: string };
  let userB: { id: string };
  let collectionB: { id: string };
  let privateTitle: string;
  let privateDescription: string;

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    detailMetadata = (await import('@/app/(app)/wishlists/[id]/page')).generateMetadata;
    editMetadata = (await import('@/app/(app)/wishlists/[id]/edit/page')).generateMetadata;
    ({ wishlistMetadataTitle: metadataTitle } = await import('@/lib/wishlists/metadata'));

    userA = await prisma.user.create({
      data: {
        email: `meta-a-${suffix}@example.test`,
        username: `meta-a-${suffix}`,
        displayName: 'Metadata A',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
    userB = await prisma.user.create({
      data: {
        email: `meta-b-${suffix}@example.test`,
        username: `meta-b-${suffix}`,
        displayName: 'Metadata B',
        passwordHash: 'not-a-real-hash',
        role: 'USER',
      },
      select: { id: true },
    });
  });

  beforeEach(async () => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    privateTitle = `Secret Foreign Collection ${stamp}`;
    privateDescription = `Private description ${stamp}`;

    collectionB = await prisma.wishlist.create({
      data: {
        ownerId: userB.id,
        title: privateTitle,
        description: privateDescription,
        slug: `secret-${stamp}`,
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

  it('gives a foreign collection generic detail metadata', async () => {
    const metadata = await detailMetadata({
      params: Promise.resolve({ id: collectionB.id }),
    } as never);

    expect(String(metadata.title)).not.toContain(privateTitle);
    expect(String(metadata.title)).toBe('Wishlist — DerList');
  });

  it('gives a foreign collection generic edit metadata', async () => {
    const metadata = await editMetadata({
      params: Promise.resolve({ id: collectionB.id }),
    } as never);

    expect(String(metadata.title)).not.toContain(privateTitle);
    expect(String(metadata.title)).toBe('Edit Wishlist — DerList');
  });

  it('gives an unknown collection generic metadata', async () => {
    const metadata = await detailMetadata({
      params: Promise.resolve({ id: 'missing-collection-id' }),
    } as never);

    expect(String(metadata.title)).toBe('Wishlist — DerList');
  });

  it('gives signed-out requests generic metadata', async () => {
    session.user = null;

    const detail = await detailMetadata({
      params: Promise.resolve({ id: collectionB.id }),
    } as never);
    const edit = await editMetadata({
      params: Promise.resolve({ id: collectionB.id }),
    } as never);

    expect(String(detail.title)).toBe('Wishlist — DerList');
    expect(String(edit.title)).toBe('Edit Wishlist — DerList');
  });

  it('keeps the real title for the owner', async () => {
    session.user = { id: userB.id, role: 'USER' };

    const detail = await detailMetadata({
      params: Promise.resolve({ id: collectionB.id }),
    } as never);
    const edit = await editMetadata({
      params: Promise.resolve({ id: collectionB.id }),
    } as never);

    expect(String(detail.title)).toBe(`${privateTitle} — DerList`);
    expect(String(edit.title)).toBe(`Edit ${privateTitle} — DerList`);
  });

  it('returns no title for a null user at the data-access layer', async () => {
    expect(await metadataTitle(collectionB.id, null, 'detail')).toBe('Wishlist — DerList');
    expect(await metadataTitle(collectionB.id, userA.id, 'detail')).toBe('Wishlist — DerList');
    expect(await metadataTitle(collectionB.id, userB.id, 'detail')).toContain(privateTitle);
  });
});
