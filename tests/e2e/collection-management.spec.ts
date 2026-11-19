import { expect, test } from '@playwright/test';
import {
  createTestCollection,
  createTestUser,
  deleteTestUsers,
  prisma,
  signIn,
  uniqueSuffix,
} from './helpers';

test.describe('collection bulk management', () => {
  let user: { id: string };

  test.beforeAll(async () => {
    user = await createTestUser('collection-e2e');
  });

  test.afterAll(async () => {
    await deleteTestUsers([user.id]);
  });

  test('enforces the 500-item cap with a clear message on a large collection', async ({
    browser,
  }) => {
    test.setTimeout(150_000);

    const stamp = uniqueSuffix();
    const collection = await createTestCollection(user.id, `Large collection ${stamp}`);
    await prisma.wishlistItem.createMany({
      data: Array.from({ length: 501 }, (_, index) => ({
        wishlistId: collection.id,
        title: `Large item ${index + 1} ${stamp}`,
        position: index,
        currency: 'USD',
      })),
    });

    const context = await signIn(browser, user.id);
    const page = await context.newPage();
    await page.goto(`/wishlists/${collection.id}`);

    const selectAll = page.getByRole('checkbox', {
      name: 'Select all 501 visible products',
    });
    await selectAll.click();

    const toolbar = page.getByRole('toolbar', { name: 'Bulk product actions' });
    await expect(toolbar).toContainText('501 products selected');

    await page.getByLabel('Change priority of selected products').selectOption('4');

    await expect(page.getByText('Select up to 500 products at a time.')).toBeVisible();
    expect(
      await prisma.wishlistItem.count({ where: { wishlistId: collection.id, starPriority: 4 } })
    ).toBe(0);
    await expect(toolbar).toContainText('501 products selected');

    await context.close();
  });

  test('keeps select-all-visible and select-all-in-collection distinct across filters', async ({
    browser,
  }) => {
    const stamp = uniqueSuffix();
    const collection = await createTestCollection(user.id, `Filtered collection ${stamp}`);

    await prisma.wishlistItem.createMany({
      data: [
        {
          wishlistId: collection.id,
          title: `Alpha laptop ${stamp}`,
          position: 0,
          category: 'Audio',
        },
        {
          wishlistId: collection.id,
          title: `Beta speaker ${stamp}`,
          position: 1,
          category: 'Audio',
        },
        {
          wishlistId: collection.id,
          title: `Gamma monitor ${stamp}`,
          position: 2,
          category: 'Video',
        },
      ],
    });

    const context = await signIn(browser, user.id);
    const page = await context.newPage();
    await page.goto(`/wishlists/${collection.id}?q=Alpha`);

    await expect(page.getByText('1 shown · 3 in collection').first()).toBeVisible();
    await page.getByRole('checkbox', { name: 'Select all 1 visible products' }).click();

    const toolbar = page.getByRole('toolbar', { name: 'Bulk product actions' });
    await expect(toolbar).toContainText('1 product selected');

    // Selecting the whole collection must include products hidden by search.
    await page.getByRole('button', { name: 'Select all 3 in this collection' }).click();
    await expect(toolbar).toContainText('3 products selected');

    // Clearing is a distinct action and hides the toolbar immediately.
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(toolbar).toBeHidden();

    // Reselect the whole collection and apply the bulk change.
    await page.getByRole('checkbox', { name: 'Select all 1 visible products' }).click();
    await page.getByRole('button', { name: 'Select all 3 in this collection' }).click();
    await expect(toolbar).toContainText('3 products selected');

    await page.getByLabel('Change priority of selected products').selectOption('4');
    await expect(page.getByText('Updated the priority of 3 products.')).toBeVisible();
    expect(
      await prisma.wishlistItem.count({ where: { wishlistId: collection.id, starPriority: 4 } })
    ).toBe(3);

    // Purchase-state filtering uses the same visible/collection distinction.
    await prisma.wishlistItem.updateMany({
      where: { wishlistId: collection.id, title: { contains: 'Beta' } },
      data: { purchased: true, purchasedAt: new Date() },
    });

    await page.goto(`/wishlists/${collection.id}?filter=unpurchased`);
    await expect(page.getByText('2 shown · 3 in collection').first()).toBeVisible();
    await page.getByRole('checkbox', { name: 'Select all 2 visible products' }).click();
    await expect(toolbar).toContainText('2 products selected');

    await context.close();
  });

  test('reports partial bulk failures instead of hiding them', async ({ browser }) => {
    const stamp = uniqueSuffix();
    const collection = await createTestCollection(user.id, `Partial collection ${stamp}`);

    const first = await prisma.wishlistItem.create({
      data: { wishlistId: collection.id, title: `Partial first ${stamp}`, position: 0 },
    });
    const second = await prisma.wishlistItem.create({
      data: { wishlistId: collection.id, title: `Partial second ${stamp}`, position: 1 },
    });

    const context = await signIn(browser, user.id);
    const page = await context.newPage();
    await page.goto(`/wishlists/${collection.id}`);

    await page.getByRole('checkbox', { name: 'Select all 2 visible products' }).click();
    await expect(page.getByRole('toolbar', { name: 'Bulk product actions' })).toContainText(
      '2 products selected'
    );

    // Simulate another tab archiving one of the selected products just before
    // the bulk request. The server must update the remaining item and report
    // the skipped one.
    await prisma.wishlistItem.update({
      where: { id: first.id },
      data: { archived: true, archivedAt: new Date() },
    });

    await page.getByLabel('Change priority of selected products').selectOption('2');

    await expect(page.getByText(/1 skipped/)).toBeVisible();
    expect((await prisma.wishlistItem.findUnique({ where: { id: first.id } }))?.starPriority).toBe(
      1
    );
    expect((await prisma.wishlistItem.findUnique({ where: { id: second.id } }))?.starPriority).toBe(
      2
    );

    await context.close();
  });

  test('selects and restores only the archived items in a category filter', async ({ browser }) => {
    const stamp = uniqueSuffix();
    const collection = await createTestCollection(user.id, `Archive category ${stamp}`);

    await prisma.wishlistItem.createMany({
      data: [
        {
          wishlistId: collection.id,
          title: `Audio archived one ${stamp}`,
          category: 'Audio',
          archived: true,
          archivedAt: new Date(),
          position: 0,
        },
        {
          wishlistId: collection.id,
          title: `Audio archived two ${stamp}`,
          category: 'Audio',
          archived: true,
          archivedAt: new Date(),
          position: 1,
        },
        {
          wishlistId: collection.id,
          title: `Video archived ${stamp}`,
          category: 'Video',
          archived: true,
          archivedAt: new Date(),
          position: 2,
        },
      ],
    });

    const context = await signIn(browser, user.id);
    const page = await context.newPage();
    await page.goto(`/wishlists/${collection.id}/archive?category=Audio`);

    await page.getByRole('checkbox', { name: 'Select all 2 archived products' }).click();
    const toolbar = page.getByRole('toolbar', { name: 'Bulk product actions' });
    await expect(toolbar).toContainText('2 products selected');
    await toolbar.getByRole('button', { name: 'Restore' }).click();

    await expect(page.getByText('Restored 2 products.')).toBeVisible();
    expect(
      await prisma.wishlistItem.count({ where: { wishlistId: collection.id, archived: true } })
    ).toBe(1);
    expect(
      await prisma.wishlistItem.count({
        where: { wishlistId: collection.id, archived: false, category: 'Audio' },
      })
    ).toBe(2);

    await context.close();
  });

  test('duplicates a collection into independent items and category records', async ({
    browser,
  }) => {
    const stamp = uniqueSuffix();
    const sourceTitle = `Duplicate source ${stamp}`;
    const source = await createTestCollection(user.id, sourceTitle, {
      description: 'Collection description',
      icon: '🎧',
      color: '#3b82f6',
    });
    const category = await prisma.wishlistCategory.create({
      data: {
        wishlistId: source.id,
        name: 'Audio',
        description: 'Sound gear',
        icon: '🔊',
      },
    });
    await prisma.wishlistItem.create({
      data: {
        wishlistId: source.id,
        title: `Source headphones ${stamp}`,
        notes: 'Wait for a sale',
        url: 'https://example.com/headphones',
        currentPrice: 249.99,
        targetPrice: 199.99,
        brand: 'Example Audio',
        model: 'X100',
        quantity: 2,
        starPriority: 3,
        category: 'Audio',
        wishlistCategoryId: category.id,
        metadata: JSON.stringify({ tags: 'audio, wireless' }),
        position: 0,
      },
    });
    await prisma.wishlistItem.create({
      data: {
        wishlistId: source.id,
        title: `Archived source ${stamp}`,
        archived: true,
        archivedAt: new Date(),
        position: 1,
      },
    });

    const context = await signIn(browser, user.id);
    const page = await context.newPage();
    await page.goto('/wishlists');

    await page.getByRole('button', { name: `Actions for ${sourceTitle}` }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForURL(/\/wishlists\/[a-z0-9]+$/);
    await expect(
      page.getByRole('heading', { level: 1, name: `${sourceTitle} (Copy)` })
    ).toBeVisible();

    const copy = await prisma.wishlist.findFirst({
      where: { ownerId: user.id, title: `${sourceTitle} (Copy)` },
      include: { items: true, categories: true },
    });
    expect(copy).not.toBeNull();
    expect(copy?.description).toBe('Collection description');
    expect(copy?.icon).toBe('🎧');
    expect(copy?.color).toBe('#3b82f6');
    expect(copy?.items).toHaveLength(1);
    expect(copy?.categories).toHaveLength(1);
    expect(copy?.items[0].id).not.toBeUndefined();
    expect(copy?.items[0].notes).toBe('Wait for a sale');
    expect(copy?.items[0].targetPrice?.toString()).toBe('199.99');
    expect(copy?.items[0].metadata).toBe(JSON.stringify({ tags: 'audio, wireless' }));
    expect(copy?.items[0].wishlistCategoryId).toBe(copy?.categories[0].id);
    expect(copy?.categories[0].id).not.toBe(category.id);
    expect(copy?.categories[0].name).toBe('Audio');
    expect(copy?.categories[0].description).toBe('Sound gear');

    const sourceItems = await prisma.wishlistItem.findMany({
      where: { wishlistId: source.id, archived: false },
    });
    expect(copy?.items[0].id).not.toBe(sourceItems[0].id);
    expect(
      await prisma.wishlistItem.count({ where: { wishlistId: copy!.id, archived: true } })
    ).toBe(0);

    await context.close();
  });
});
