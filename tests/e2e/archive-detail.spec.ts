import { expect, test, type Page } from '@playwright/test';
import {
  createTestCollection,
  createTestUser,
  deleteTestUsers,
  prisma,
  signIn,
  uniqueSuffix,
} from './helpers';

test.describe('archived product details', () => {
  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string; title: string };
  let collectionB: { id: string; title: string };
  let archivedItem: { id: string; title: string };
  let foreignItem: { id: string };

  test.beforeAll(async () => {
    userA = await createTestUser('archive-detail-a');
    userB = await createTestUser('archive-detail-b');
  });

  test.beforeEach(async () => {
    const stamp = uniqueSuffix();

    collectionA = await createTestCollection(userA.id, `Archive detail ${stamp}`);
    collectionB = await createTestCollection(userB.id, `Foreign archive ${stamp}`);

    archivedItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionA.id,
        title: `Archived headphones ${stamp}`,
        description: 'Closed-back reference headphones.',
        notes: 'Wait for a sale before buying.',
        url: 'https://example.com/headphones',
        brand: 'Example Audio',
        model: 'X100',
        retailer: 'Example Store',
        currentPrice: 249.99,
        targetPrice: 199.99,
        originalPrice: 299.99,
        currency: 'USD',
        quantity: 2,
        starPriority: 3,
        priority: 'HIGH',
        category: 'Audio',
        condition: 'New',
        availability: 'In stock',
        metadata: JSON.stringify({
          tags: 'wireless, audio',
          storeUrl: 'https://example.com/store/headphones',
          importedFrom: 'https://example.com/source',
          provider: 'Example provider',
          images: ['https://example.com/headphones-2.jpg'],
          specs: [{ key: 'Battery', value: '30', unit: 'hours' }],
        }),
        archived: true,
        archivedAt: new Date(),
        position: 0,
      },
      select: { id: true, title: true },
    });

    foreignItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionB.id,
        title: `Foreign archived product ${stamp}`,
        notes: 'Private foreign notes',
        archived: true,
        archivedAt: new Date(),
        position: 0,
      },
      select: { id: true },
    });
  });

  test.afterAll(async () => {
    await deleteTestUsers([userA.id, userB.id]);
  });

  async function openDetails(page: Page) {
    await page.goto(
      `/wishlists/${collectionA.id}/archive?q=${encodeURIComponent('Archived')}&category=Audio`
    );
    await page.getByRole('link', { name: `View details for ${archivedItem.title}` }).click();
    await expect(page).toHaveURL(new RegExp(`/archive/${archivedItem.id}`));
  }

  test('opens the archive detail page with all saved information and does not restore it', async ({
    browser,
  }) => {
    const context = await signIn(browser, userA.id);
    const page = await context.newPage();

    await openDetails(page);

    expect(new URL(page.url()).searchParams.get('q')).toBe('Archived');
    expect(new URL(page.url()).searchParams.get('category')).toBe('Audio');

    await expect(page.getByRole('heading', { level: 1, name: archivedItem.title })).toBeVisible();
    await expect(page.getByText('This product is archived and read-only')).toBeVisible();
    await expect(page.getByText('Closed-back reference headphones.')).toBeVisible();
    await expect(page.getByText('Wait for a sale before buying.')).toBeVisible();
    await expect(page.getByText('×2', { exact: true })).toBeVisible();
    await expect(page.getByText('Need This')).toBeVisible();
    await expect(page.getByText('Audio', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /View on Example Store/i })).toHaveAttribute(
      'href',
      'https://example.com/headphones'
    );
    await expect(page.getByRole('link', { name: 'Store listing' })).toHaveAttribute(
      'href',
      'https://example.com/store/headphones'
    );
    await expect(page.getByRole('list', { name: 'Product tags' })).toContainText('wireless');
    await expect(page.getByRole('list', { name: 'Product tags' })).toContainText('audio');
    await expect(page.getByText(/Battery/)).toBeVisible();
    await expect(page.getByText(/30 hours/)).toBeVisible();
    await expect(page.getByRole('button', { name: `Restore ${archivedItem.title}` })).toBeVisible();

    const stored = await prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } });
    expect(stored?.archived).toBe(true);

    // The archive back link preserves the active search and category context.
    await page.getByRole('link', { name: 'Back to archived products' }).click();
    await expect(page).toHaveURL(new RegExp(`/archive\\?q=Archived&category=Audio`));

    await context.close();
  });

  test("rejects another account's archived product with a 404", async ({ browser }) => {
    const context = await signIn(browser, userA.id);
    const page = await context.newPage();

    await page.goto(`/wishlists/${collectionB.id}/archive/${foreignItem.id}`);

    // The App Router streams its shell, so the HTTP status is 200 even when a
    // page resolves to not-found. What matters for authorization is that the
    // final UI is the 404 boundary and no private fields are present.
    await expect(page.getByRole('heading', { name: 'Archived product not found' })).toBeVisible();
    await expect(page.getByText('Foreign archived product', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Private foreign notes', { exact: false })).toHaveCount(0);

    // A foreign item id paired with the attacker's own collection must also fail.
    await page.goto(`/wishlists/${collectionA.id}/archive/${foreignItem.id}`);
    await expect(page.getByRole('heading', { name: 'Archived product not found' })).toBeVisible();
    await expect(page.getByText('Foreign archived product', { exact: false })).toHaveCount(0);

    const stored = await prisma.wishlistItem.findUnique({ where: { id: foreignItem.id } });
    expect(stored?.notes).toBe('Private foreign notes');
    expect(stored?.archived).toBe(true);

    await context.close();
  });

  test('restores from the detail page without duplicating or losing data', async ({ browser }) => {
    const context = await signIn(browser, userA.id);
    const page = await context.newPage();
    const itemCountBefore = await prisma.wishlistItem.count({
      where: { wishlistId: collectionA.id },
    });

    await openDetails(page);
    await page.getByRole('button', { name: `Restore ${archivedItem.title}` }).click();

    await expect(page).toHaveURL(
      new RegExp(`/wishlists/${collectionA.id}/archive\\?q=Archived&category=Audio`)
    );
    await expect(page.getByText(/Restored 1 product/)).toBeVisible();

    // A stale detail link for the now-active product redirects to the collection.
    await page.goto(`/wishlists/${collectionA.id}/archive/${archivedItem.id}`);
    await expect(page).toHaveURL(new RegExp(`/wishlists/${collectionA.id}$`));

    await expect
      .poll(
        async () =>
          (await prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } }))?.archived
      )
      .toBe(false);

    const stored = await prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } });
    expect(stored?.archivedAt).toBeNull();
    expect(stored?.title).toBe(archivedItem.title);
    expect(stored?.notes).toBe('Wait for a sale before buying.');
    expect(stored?.targetPrice?.toString()).toBe('199.99');
    expect(stored?.quantity).toBe(2);
    expect(stored?.metadata).toContain('"tags":"wireless, audio"');
    expect(await prisma.wishlistItem.count({ where: { wishlistId: collectionA.id } })).toBe(
      itemCountBefore
    );

    await context.close();
  });

  test('requires confirmation before permanent deletion', async ({ browser }) => {
    const context = await signIn(browser, userA.id);
    const page = await context.newPage();

    await openDetails(page);

    const trigger = page.getByRole('button', {
      name: `Delete ${archivedItem.title} permanently`,
    });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Delete permanently?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(archivedItem.title);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect(await prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } })).not.toBeNull();

    await trigger.click();
    const confirmDialog = page.getByRole('dialog', { name: 'Delete permanently?' });
    await confirmDialog.getByRole('button', { name: 'Delete permanently' }).click();

    await expect(page).toHaveURL(new RegExp(`/wishlists/${collectionA.id}/archive`));
    await expect
      .poll(async () => prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } }))
      .toBeNull();

    await context.close();
  });

  test('viewing and reloading an archived product never restores it', async ({ browser }) => {
    const context = await signIn(browser, userA.id);
    const page = await context.newPage();

    await openDetails(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: archivedItem.title })).toBeVisible();
    await page.reload();

    const stored = await prisma.wishlistItem.findUnique({ where: { id: archivedItem.id } });
    expect(stored?.archived).toBe(true);
    expect(stored?.archivedAt).not.toBeNull();

    await context.close();
  });

  test('shows legacy imported specifications written under the old key', async ({ browser }) => {
    const legacy = await prisma.wishlistItem.create({
      data: {
        wishlistId: collectionA.id,
        title: `Legacy specs ${uniqueSuffix()}`,
        category: 'Audio',
        metadata: JSON.stringify({
          specifications: [{ key: 'Impedance', value: '32', unit: 'ohm' }],
        }),
        archived: true,
        archivedAt: new Date(),
        position: 2,
      },
      select: { id: true },
    });

    const context = await signIn(browser, userA.id);
    const page = await context.newPage();
    await page.goto(`/wishlists/${collectionA.id}/archive/${legacy.id}`);

    // Scope to the visible app landmark: the dev router can retain a hidden
    // copy of a previously visited page with the same specification text.
    const main = page.locator('#main-content');
    await expect(main.getByText('Impedance', { exact: true })).toBeVisible();
    await expect(main.getByText('32 ohm', { exact: true })).toBeVisible();

    await context.close();
  });

  test('handles a permanently deleted detail URL with the archive 404 state', async ({
    browser,
  }) => {
    const context = await signIn(browser, userA.id);
    const page = await context.newPage();
    const detailPath = `/wishlists/${collectionA.id}/archive/${archivedItem.id}`;

    await page.goto(detailPath);
    await page.getByRole('button', { name: `Delete ${archivedItem.title} permanently` }).click();
    await page
      .getByRole('dialog', { name: 'Delete permanently?' })
      .getByRole('button', { name: 'Delete permanently' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/wishlists/${collectionA.id}/archive`));

    await page.goto(detailPath);
    await expect(page.getByRole('heading', { name: 'Archived product not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to archive', exact: true })).toBeVisible();

    await context.close();
  });

  test('mobile archive navigation fits the viewport and preserves filters', async ({ browser }) => {
    const context = await signIn(browser, userA.id, {
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto(
      `/wishlists/${collectionA.id}/archive?q=${encodeURIComponent('Archived')}&category=Audio`
    );
    await expect(page.getByRole('heading', { name: 'Archived products' })).toBeVisible();

    const archiveOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(archiveOverflow).toBeLessThanOrEqual(1);

    await page.getByRole('link', { name: `View details for ${archivedItem.title}` }).click();
    await expect(page.getByRole('heading', { level: 1, name: archivedItem.title })).toBeVisible();

    const detailOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(detailOverflow).toBeLessThanOrEqual(1);

    await expect(page.getByRole('button', { name: `Restore ${archivedItem.title}` })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Delete ${archivedItem.title} permanently` })
    ).toBeVisible();

    await page.getByRole('link', { name: 'Back to archived products' }).click();
    await expect(page).toHaveURL(/\/archive\?q=Archived&category=Audio/);

    await context.close();
  });
});
