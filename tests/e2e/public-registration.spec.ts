import { expect, test } from '@playwright/test';
import { hashPassword } from '../../src/lib/auth/password';
import { prisma, uniqueSuffix } from './helpers';

let createdEmails: string[] = [];

test.afterEach(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  createdEmails = [];
});

test('registers publicly with a username and reaches the first-run dashboard', async ({ page }) => {
  const suffix = uniqueSuffix();
  const username = `e2e-${suffix}`;
  const email = `e2e-${suffix}@example.test`;
  createdEmails.push(email);

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByText('Open Beta — everyone can join')).toBeVisible();

  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Display name').fill('E2E Person');
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByLabel('Confirm password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL(/\/dashboard\?welcome=1/);
  await expect(page.getByRole('heading', { name: 'Welcome, E2E' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Your account is ready/ })).toBeVisible();
  await expect(page.getByText(`@${username}`).first()).toBeVisible();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, username: true, emailVerified: true, passwordHash: true },
  });

  expect(user?.username).toBe(username);
  expect(user?.emailVerified).toBe(false);
  expect(user?.passwordHash).not.toBe('!no-password');
});

test('registers with email only and generates a valid username', async ({ page }) => {
  const suffix = uniqueSuffix();
  const email = `emailonly-${suffix}@example.test`;
  createdEmails.push(email);

  await page.goto('/register?method=email');
  await expect(page.getByRole('heading', { name: 'Register with email' })).toBeVisible();

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByLabel('Confirm password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL(/\/dashboard\?welcome=1/);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { username: true, displayName: true },
  });

  expect(user?.username).toBeTruthy();
  expect(user?.username).toMatch(/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/);
  expect(user?.displayName).toBe(user?.username);
});

test('signs in with a username or email, case-insensitively', async ({ page }) => {
  const suffix = uniqueSuffix();
  const username = `login-${suffix}`;
  const email = `login-${suffix}@example.test`;
  createdEmails.push(email);

  await prisma.user.create({
    data: {
      email,
      username,
      displayName: 'Login Person',
      passwordHash: await hashPassword('CorrectHorse123'),
      emailVerified: true,
    },
  });

  await page.goto('/login');
  await page.getByLabel('Email or username').fill(username.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome, Login' })).toBeVisible();

  await page.context().clearCookies();

  await page.goto('/login');
  await page.getByLabel('Email or username').fill(email.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard');
});

test('rejects duplicate usernames and emails with useful messages', async ({ page }) => {
  const suffix = uniqueSuffix();
  const email = `duplicate-${suffix}@example.test`;
  const username = `duplicate-${suffix}`;
  createdEmails.push(email);

  await page.goto('/register');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByLabel('Confirm password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/dashboard\?welcome=1/);

  await page.context().clearCookies();

  // Duplicate email, different case.
  await page.goto('/register?method=email');
  await page.getByLabel('Email', { exact: true }).fill(email.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByLabel('Confirm password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(
    page.getByText('An account with this email already exists. Sign in instead.')
  ).toBeVisible();

  // Duplicate username with a fresh email.
  const otherEmail = `duplicate-other-${suffix}@example.test`;
  createdEmails.push(otherEmail);
  await page.goto('/register');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(otherEmail);
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByLabel('Confirm password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('This username is already taken.')).toBeVisible();

  expect(await prisma.user.count({ where: { email: otherEmail } })).toBe(0);
});

test('shows validation messages without creating an account', async ({ page }) => {
  const email = `invalid-${uniqueSuffix()}@example.test`;

  await page.goto('/register');
  await page.getByLabel('Username', { exact: true }).fill('No Spaces!');
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText(/Username may contain only/)).toBeVisible();
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  expect(await prisma.user.count({ where: { email } })).toBe(0);
});

test('registration works on a mobile viewport without horizontal overflow', async ({ page }) => {
  const suffix = uniqueSuffix();
  const email = `mobile-${suffix}@example.test`;
  createdEmails.push(email);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');

  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  await page.getByLabel('Username', { exact: true }).fill(`mobile-${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('CorrectHorse123');
  await page.getByLabel('Confirm password', { exact: true }).fill('CorrectHorse123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL(/\/dashboard\?welcome=1/);
  await expect(page.getByRole('heading', { name: /Your account is ready/ })).toBeVisible();
});

test('signed-out visitors cannot open the dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL(/\/login(\?|$)/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('login and recovery pages are reachable from registration', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.waitForURL('**/login');
  await expect(page.getByRole('link', { name: 'Create a free account' })).toBeVisible();

  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
});
