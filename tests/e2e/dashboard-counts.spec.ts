import { expect, test, type Page } from '@playwright/test';
import {
  createTestCollection,
  createTestUser,
  deleteTestUsers,
  prisma,
  signIn,
  uniqueSuffix,
} from './helpers';

/**
 * Dashboard counts must describe the active view: archived collections and
 * archived products are hidden from it. Collection cards likewise count active
 * products separately from archived ones.
 */
test.describe('dashboard counts', () => {
  let user: { id: string };

  test.beforeAll(async () => {
    user = await createTestUser('dashboard-e2e');
  });

  test.afterAll(async () => {
    await deleteTestUsers([user.id]);
  });

  function statValue(page: Page, label: string) {
    return page.getByText(label, { exact: true }).locator('..').locator('span').last();
  }

  test('reports active collections and active products only', async ({ browser }) => {
    const stamp = uniqueSuffix();
    const active = await createTestCollection(user.id, `Active collection ${stamp}`);
    const archived = await prisma.wishlist.create({
      data: {
        ownerId: user.id,
        title: `Archived collection ${stamp}`,
        slug: `archived-collection-${stamp}`,
        archived: true,
      },
      select: { id: true, title: true },
    });

    await prisma.wishlistItem.createMany({
      data: [
        { wishlistId: active.id, title: `Active one ${stamp}`, position: 0 },
        { wishlistId: active.id, title: `Active two ${stamp}`, position: 1 },
        {
          wishlistId: active.id,
          title: `Archived product ${stamp}`,
          archived: true,
          archivedAt: new Date(),
          position: 2,
        },
        {
          wishlistId: archived.id,
          title: `Hidden active ${stamp}`,
          position: 0,
        },
      ],
    });

    const context = await signIn(browser, user.id);
    const page = await context.newPage();

    await page.goto('/dashboard');

    await expect(statValue(page, 'Active Wishlists')).toHaveText('1');
    await expect(statValue(page, 'Total Items')).toHaveText('2');
    await expect(statValue(page, 'Purchased')).toHaveText('0');
    await expect(statValue(page, 'Remaining')).toHaveText('2');

    // Recent collections count only active products and exclude archived ones.
    const activeRow = page.locator(`a[href="/wishlists/${active.id}"]`).first();
    await expect(activeRow).toContainText('2 items');
    await expect(page.locator(`a[href="/wishlists/${archived.id}"]`)).toHaveCount(0);
    await expect(page.getByText(`Hidden active ${stamp}`)).toHaveCount(0);

    await page.goto('/wishlists');

    const activeCard = page
      .locator('div.group', {
        has: page.locator(`a[href="/wishlists/${active.id}"]`),
      })
      .first();
    await expect(activeCard).toContainText('2 items');
    await expect(activeCard).toContainText('1 archived');

    await context.close();
  });

  test('reports collection-header and card counts for mixed active and archived products', async ({
    browser,
  }) => {
    // This test owns its user so its collection counts are unaffected by the
    // collections created above.
    const mixedUser = await createTestUser('dashboard-counts-mixed');
    try {
      const stamp = uniqueSuffix();
      const active = await createTestCollection(mixedUser.id, `Mixed collection ${stamp}`);
      const archived = await prisma.wishlist.create({
        data: {
          ownerId: mixedUser.id,
          title: `Hidden collection ${stamp}`,
          slug: `hidden-collection-${stamp}`,
          archived: true,
        },
        select: { id: true, title: true },
      });

      await prisma.wishlistItem.createMany({
        data: [
          { wishlistId: active.id, title: `Mixed active one ${stamp}`, position: 0 },
          {
            wishlistId: active.id,
            title: `Mixed active purchased ${stamp}`,
            purchased: true,
            purchasedAt: new Date(),
            position: 1,
          },
          { wishlistId: active.id, title: `Mixed active three ${stamp}`, position: 2 },
          {
            wishlistId: active.id,
            title: `Mixed archived one ${stamp}`,
            archived: true,
            archivedAt: new Date(),
            position: 3,
          },
          {
            wishlistId: active.id,
            title: `Mixed archived purchased ${stamp}`,
            purchased: true,
            purchasedAt: new Date(),
            archived: true,
            archivedAt: new Date(),
            position: 4,
          },
          {
            wishlistId: archived.id,
            title: `Hidden active ${stamp}`,
            purchased: true,
            purchasedAt: new Date(),
            position: 0,
          },
          {
            wishlistId: archived.id,
            title: `Hidden archived ${stamp}`,
            archived: true,
            archivedAt: new Date(),
            position: 1,
          },
        ],
      });

      const context = await signIn(browser, mixedUser.id);
      const page = await context.newPage();

      // Dashboard totals describe the active view only: the archived collection
      // and every archived product are excluded, including purchased ones.
      await page.goto('/dashboard');
      await expect(statValue(page, 'Active Wishlists')).toHaveText('1');
      await expect(statValue(page, 'Total Items')).toHaveText('3');
      await expect(statValue(page, 'Purchased')).toHaveText('1');
      await expect(statValue(page, 'Remaining')).toHaveText('2');
      await expect(page.locator(`a[href="/wishlists/${archived.id}"]`)).toHaveCount(0);

      // The collection card separates active products from archived ones.
      await page.goto('/wishlists');
      const card = page
        .locator('div.group', {
          has: page.locator(`a[href="/wishlists/${active.id}"]`),
        })
        .first();
      await expect(card).toContainText('3 items');
      await expect(card).toContainText('2 archived');

      // The collection header reports the archived count and links to the archive.
      await page.goto(`/wishlists/${active.id}`);
      // Streamed RSC payloads can keep a hidden copy of the same text, so only
      // the rendered header element is required.
      await expect(page.getByText(/3 items · 2 archived/).filter({ visible: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Archived (2)' })).toBeVisible();

      await page.goto(`/wishlists/${active.id}/archive`);
      await expect(page.getByRole('heading', { name: 'Archived products' })).toBeVisible();
      await expect(
        page.getByRole('checkbox', { name: 'Select all 2 archived products' })
      ).toBeVisible();

      await context.close();
    } finally {
      await deleteTestUsers([mixedUser.id]);
    }
  });
});
