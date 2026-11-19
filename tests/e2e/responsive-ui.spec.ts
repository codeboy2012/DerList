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
 * Responsive and keyboard-accessibility regression coverage.
 *
 * Collection cards and dashboard grids use truncating titles. A grid item
 * without `min-w-0` grows to the title's min-content width and forces a
 * horizontal scrollbar on phones. These checks also cover dialog/menu bounds
 * and focus restoration after closing with Escape.
 */
async function noHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(
    metrics.documentWidth,
    `document scrollWidth ${metrics.documentWidth} exceeds viewport ${metrics.viewport}`
  ).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(
    metrics.bodyWidth,
    `body scrollWidth ${metrics.bodyWidth} exceeds viewport ${metrics.viewport}`
  ).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function inViewport(page: Page, locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box, 'element should have a layout box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

test.describe('responsive layouts', () => {
  let user: { id: string };
  let collection: { id: string };
  let archivedItem: { id: string };

  test.beforeAll(async () => {
    const stamp = uniqueSuffix();
    user = await createTestUser('ui-audit');
    collection = await createTestCollection(user.id, `UI collection ${stamp}`, {
      description: 'A collection used for the layout audit',
      icon: '🎧',
    });
    const category = await prisma.wishlistCategory.create({
      data: { wishlistId: collection.id, name: 'Audio' },
    });

    await prisma.wishlistItem.create({
      data: {
        wishlistId: collection.id,
        title: `Noise cancelling headphones with a deliberately long product name ${stamp}`,
        category: 'Audio',
        wishlistCategoryId: category.id,
        currentPrice: 249.99,
        targetPrice: 199.99,
        brand: 'Example Audio',
        model: 'X100',
        retailer: 'Example Store',
        notes: 'A long note that should wrap instead of forcing the page wider than the viewport.',
        metadata: JSON.stringify({
          specifications: [{ key: 'Battery', value: '30', unit: 'hours' }],
        }),
        position: 0,
      },
      select: { id: true },
    });
    await prisma.wishlistItem.create({
      data: {
        wishlistId: collection.id,
        title: `Second product ${stamp}`,
        position: 1,
      },
      select: { id: true },
    });
    archivedItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collection.id,
        title: `Archived product ${stamp}`,
        archived: true,
        archivedAt: new Date(),
        position: 2,
      },
      select: { id: true },
    });
  });

  test.afterAll(async () => {
    await deleteTestUsers([user.id]);
  });

  test('mobile layouts do not overflow and dialogs stay on screen', async ({ browser }) => {
    const context = await signIn(browser, user.id, { viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    for (const path of [
      '/dashboard',
      '/wishlists',
      `/wishlists/${collection.id}`,
      `/wishlists/${collection.id}/archive`,
      `/wishlists/${collection.id}/archive/${archivedItem.id}`,
    ]) {
      await page.goto(path);
      await noHorizontalOverflow(page);
    }

    // Collection card action menu stays inside the viewport and Escape returns
    // focus to its trigger.
    await page.goto('/wishlists');
    const actionsTrigger = page.getByRole('button', { name: `Actions for UI collection` });
    await actionsTrigger.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await inViewport(page, menu);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(actionsTrigger).toBeFocused();

    // Bulk toolbar wraps inside the viewport, and its confirmation dialog fits.
    await page.goto(`/wishlists/${collection.id}`);
    await page.getByRole('checkbox', { name: 'Select all 2 visible products' }).click();
    const toolbar = page.getByRole('toolbar', { name: 'Bulk product actions' });
    await expect(toolbar).toBeVisible();
    await inViewport(page, toolbar);
    await noHorizontalOverflow(page);

    await toolbar.getByRole('button', { name: 'Delete' }).click();
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByText('Delete products?')).toBeVisible();
    await inViewport(page, deleteDialog);
    await page.keyboard.press('Escape');
    await expect(deleteDialog).toBeHidden();

    // Edit dialog is keyboard reachable, fits, and Escape restores focus.
    const editButton = page.getByRole('button', { name: 'Edit', exact: true }).first();
    await editButton.click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByText('Edit product')).toBeVisible();
    await inViewport(page, editDialog);
    await page.keyboard.press('Escape');
    await expect(editDialog).toBeHidden();
    await expect(editButton).toBeFocused();

    // The full product editor drawer fits the phone viewport too.
    await editButton.click();
    await page.getByRole('button', { name: 'Full product editor' }).click();
    const productDrawer = page.getByRole('dialog');
    await expect(productDrawer.getByText('Edit Product')).toBeVisible();
    await inViewport(page, productDrawer);
    await noHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(productDrawer).toBeHidden();

    // Copy dialog fits, labels are associated, and Escape restores focus.
    await page.goto(`/wishlists/${collection.id}`);
    const copyTrigger = page.getByRole('button', { name: 'Copy', exact: true });
    await copyTrigger.click();
    const copyDialog = page.getByRole('dialog');
    await expect(copyDialog.getByText('Copy Wishlist')).toBeVisible();
    await inViewport(page, copyDialog);
    await expect(page.getByLabel('Wishlist Name')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(copyDialog).toBeHidden();
    await expect(copyTrigger).toBeFocused();

    // Archive listing actions remain usable at 390px.
    await page.goto(`/wishlists/${collection.id}/archive`);
    await page.getByRole('checkbox', { name: 'Select all 1 archived products' }).click();
    const archiveToolbar = page.getByRole('toolbar', { name: 'Bulk product actions' });
    await expect(archiveToolbar).toBeVisible();
    await inViewport(page, archiveToolbar);
    await page.getByRole('button', { name: 'Delete permanently' }).first().click();
    await expect(page.getByRole('dialog').getByText('Delete permanently?')).toBeVisible();
    await inViewport(page, page.getByRole('dialog'));
    await page.keyboard.press('Escape');

    await context.close();
  });

  test('desktop layouts and menus remain on screen', async ({ browser }) => {
    const context = await signIn(browser, user.id, { viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    for (const path of [
      '/dashboard',
      '/wishlists',
      `/wishlists/${collection.id}`,
      `/wishlists/${collection.id}/archive`,
      `/wishlists/${collection.id}/archive/${archivedItem.id}`,
    ]) {
      await page.goto(path);
      await noHorizontalOverflow(page);
    }

    await page.goto('/wishlists');
    await page.getByRole('button', { name: `Actions for UI collection` }).click();
    await inViewport(page, page.getByRole('menu'));
    await page.keyboard.press('Escape');

    await page.goto(`/wishlists/${collection.id}`);
    await page.getByRole('checkbox', { name: 'Select all 2 visible products' }).click();
    await inViewport(page, page.getByRole('toolbar', { name: 'Bulk product actions' }));

    await context.close();
  });
});
