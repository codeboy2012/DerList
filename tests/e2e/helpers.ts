import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test';
import { SESSION_COOKIE_NAME } from '../../src/lib/auth/constants';
import { prisma } from '../../src/lib/prisma';

const configuredBaseUrl =
  process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3100}`;
const origin = new URL(configuredBaseUrl).origin;

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export async function createTestUser(label: string) {
  const suffix = uniqueSuffix();
  return prisma.user.create({
    data: {
      email: `${label}-${suffix}@example.test`,
      username: `${label}-${suffix}`,
      displayName: `${label} ${suffix}`,
      passwordHash: 'not-a-real-hash',
      role: 'USER',
    },
    select: { id: true, displayName: true },
  });
}

/**
 * Create a real database session and put its raw token in the browser cookie.
 * This exercises the same authentication path as a normal sign-in without
 * needing to automate the login form in every test.
 */
export async function signIn(
  browser: Browser,
  userId: string,
  options: BrowserContextOptions = {}
): Promise<BrowserContext> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const context = await browser.newContext(options);
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: token, url: origin, httpOnly: true, sameSite: 'Lax' },
  ]);
  return context;
}

export async function createTestCollection(
  ownerId: string,
  title: string,
  overrides: { description?: string; icon?: string; color?: string } = {}
) {
  return prisma.wishlist.create({
    data: {
      ownerId,
      title,
      slug: `${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)}-${uniqueSuffix()}`,
      ...overrides,
    },
    select: { id: true, title: true },
  });
}

export async function deleteTestUsers(userIds: string[]): Promise<void> {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

export { prisma };
