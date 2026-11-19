import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateUniqueUsername, isValidUsername } from '@/lib/auth/identity';
import { hasPassword, verifyPassword } from '@/lib/auth/password';
import { createAccount, DuplicateAccountError } from '@/lib/auth/registration';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function email(label: string) {
  return `${label}-${suffix}@example.test`;
}

describe.skipIf(!hasDatabase)('public account creation', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  it('creates a normalised account with a real password hash', async () => {
    const address = email('Alice');
    createdEmails.push(address.toLowerCase());

    const user = await createAccount({
      email: `  ${address.toUpperCase()}  `,
      username: '  Alice_One  ',
      displayName: '  Alice Example  ',
      password: 'correct horse battery staple',
    });

    expect(user.email).toBe(address.toLowerCase());
    expect(user.username).toBe('alice_one');
    expect(user.displayName).toBe('Alice Example');
    expect(user.emailVerified).toBe(false);
    await expect(verifyPassword(user.passwordHash, 'correct horse battery staple')).resolves.toBe(
      true
    );
    await expect(verifyPassword(user.passwordHash, 'wrong password')).resolves.toBe(false);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const address = email('dupe-email');
    createdEmails.push(address);

    await createAccount({
      email: address,
      username: `dupe-email-${suffix}`,
      password: 'password123',
    });

    await expect(
      createAccount({
        email: address.toUpperCase(),
        username: `dupe-email-two-${suffix}`,
        password: 'password123',
      })
    ).rejects.toMatchObject({ field: 'email' });
  });

  it('rejects a duplicate username regardless of case', async () => {
    const address = email('dupe-user');
    createdEmails.push(address);
    const username = `CaseUser-${suffix}`.toLowerCase();

    await createAccount({ email: address, username, password: 'password123' });

    await expect(
      createAccount({
        email: email('dupe-user-two'),
        username: username.toUpperCase(),
        password: 'password123',
      })
    ).rejects.toBeInstanceOf(DuplicateAccountError);
  });

  it('generates a valid unique username for email-only registration', async () => {
    const address = email('generated');
    createdEmails.push(address);

    const first = await createAccount({ email: address, password: 'password123' });

    expect(isValidUsername(first.username)).toBe(true);
    expect(first.username.startsWith('generated-')).toBe(true);

    // Same local part at another domain must resolve to a different username.
    const second = await createAccount({
      email: `generated-${suffix}@other.test`,
      password: 'password123',
    });
    createdEmails.push(`generated-${suffix}@other.test`);

    expect(second.username).not.toBe(first.username);
    expect(isValidUsername(second.username)).toBe(true);
  });

  it('creates an OAuth-style account without a usable password', async () => {
    const address = email('oauth');
    createdEmails.push(address);

    const user = await createAccount({
      email: address,
      displayName: 'OAuth User',
      emailVerified: true,
    });

    expect(user.emailVerified).toBe(true);
    expect(hasPassword(user.passwordHash)).toBe(false);
    await expect(verifyPassword(user.passwordHash, '')).resolves.toBe(false);
    await expect(verifyPassword(user.passwordHash, 'anything')).resolves.toBe(false);
  });

  it('allocates unique usernames even when the natural candidate exists', async () => {
    const taken = await generateUniqueUsername(`collision-${suffix}@example.test`);
    await createAccount({
      email: `collision-${suffix}@example.test`,
      username: taken,
      password: 'password123',
    });
    createdEmails.push(`collision-${suffix}@example.test`);

    const next = await generateUniqueUsername(`collision-${suffix}@example.test`);
    expect(next).not.toBe(taken);
    expect(isValidUsername(next)).toBe(true);
  });
});
