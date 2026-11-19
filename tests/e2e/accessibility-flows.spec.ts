import { expect, test, type Locator } from '@playwright/test';
import {
  createTestCollection,
  createTestUser,
  deleteTestUsers,
  prisma,
  signIn,
  uniqueSuffix,
} from './helpers';

/**
 * Release-critical accessibility coverage.
 *
 * These are browser/assertion-level checks (accessible names, roles, focus
 * order, keyboard operation and live-region markup). No screen reader was used
 * to validate announcements, so this is not a screen-reader audit.
 */
async function focusIsInside(container: Locator): Promise<boolean> {
  return container.evaluate((node) => node.contains(document.activeElement));
}

test.describe('release-critical accessibility flows', () => {
  let user: { id: string };
  let bulkCollection: { id: string; title: string };
  let itemCollection: { id: string; title: string };
  let detailedItemTitle: string;

  test.beforeAll(async () => {
    user = await createTestUser('a11y-e2e');
    const stamp = uniqueSuffix();
    bulkCollection = await createTestCollection(user.id, `Bulk a11y ${stamp}`);
    itemCollection = await createTestCollection(user.id, `Dialog a11y ${stamp}`);
    detailedItemTitle = `Detailed product ${stamp}`;

    await prisma.wishlistItem.createMany({
      data: [
        { wishlistId: bulkCollection.id, title: `Bulk one ${stamp}`, position: 0 },
        { wishlistId: bulkCollection.id, title: `Bulk two ${stamp}`, position: 1 },
      ],
    });
    await prisma.wishlistItem.create({
      data: {
        wishlistId: itemCollection.id,
        title: detailedItemTitle,
        brand: 'Example Audio',
        notes: 'Saved notes',
        position: 0,
      },
    });
  });

  test.afterAll(async () => {
    await deleteTestUsers([user.id]);
  });

  test('announces bulk selection and the bulk-action result', async ({ browser }) => {
    const context = await signIn(browser, user.id);
    const page = await context.newPage();
    await page.goto(`/wishlists/${bulkCollection.id}`);

    // Selection is reachable and named for assistive technology.
    const selectAll = page.getByRole('checkbox', { name: 'Select all 2 visible products' });
    await expect(selectAll).not.toBeChecked();
    await selectAll.focus();
    await page.keyboard.press('Space');
    await expect(selectAll).toBeChecked();

    const toolbar = page.getByRole('toolbar', { name: 'Bulk product actions' });
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toContainText('2 products selected');

    // The result is announced through a labelled polite live region and an
    // alert, and the selection is cleared afterwards.
    const notifications = page.locator('[aria-live="polite"][aria-label="Notifications"]');
    await expect(notifications).toHaveCount(0);

    const archiveButton = toolbar.getByRole('button', { name: 'Archive' });
    await archiveButton.focus();
    await page.keyboard.press('Enter');

    // Scope to the notification region: Next's route announcer is also role=alert.
    const alert = notifications.getByRole('alert');
    await expect(alert).toContainText('Archived 2 products.');
    await expect(notifications).toBeVisible();
    await expect(notifications).toContainText('Archived 2 products.');
    await expect(toolbar).toBeHidden();

    await expect
      .poll(() =>
        prisma.wishlistItem.count({ where: { wishlistId: bulkCollection.id, archived: true } })
      )
      .toBe(2);

    await context.close();
  });

  test('keeps focus in the details dialog and the product drawer, and restores it', async ({
    browser,
  }) => {
    const context = await signIn(browser, user.id, { viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`/wishlists/${itemCollection.id}`);

    const editButton = page.getByRole('button', { name: 'Edit', exact: true }).first();
    await editButton.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Edit product')).toBeVisible();
    await expect.poll(() => focusIsInside(dialog)).toBe(true);

    // Tab stays inside the modal dialog.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      expect(await focusIsInside(dialog)).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();

    // The full editor drawer is opened from the dialog.
    await editButton.focus();
    await page.keyboard.press('Enter');
    const fullEditor = page.getByRole('button', { name: 'Full product editor' });
    await fullEditor.focus();
    await page.keyboard.press('Enter');

    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Edit Product')).toBeVisible();
    await expect.poll(() => focusIsInside(drawer)).toBe(true);

    // Shift+Tab from the panel wraps to its last focusable control, and Tab
    // cycles back inside rather than reaching the page behind the drawer.
    await page.keyboard.press('Shift+Tab');
    expect(await focusIsInside(drawer)).toBe(true);
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      expect(await focusIsInside(drawer)).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(editButton).toBeFocused();

    await context.close();
  });

  test('exposes menu state and skips disabled actions', async ({ browser }) => {
    // A single collection has no valid move in either direction, so both
    // ordering actions are disabled when the menu opens.
    const menuUser = await createTestUser('a11y-menu');
    try {
      const stamp = uniqueSuffix();
      const onlyCollection = await createTestCollection(menuUser.id, `Menu a11y ${stamp}`);
      const context = await signIn(browser, menuUser.id);
      const page = await context.newPage();
      await page.goto('/wishlists');

      const trigger = page.getByRole('button', { name: `Actions for ${onlyCollection.title}` });
      await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.focus();
      await page.keyboard.press('Enter');

      const menu = page.getByRole('menu');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toBeVisible();
      await expect(menu).toBeFocused();
      await expect(menu.getByRole('menuitem')).toHaveCount(5);
      await expect(menu.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
      await expect(menu.getByRole('menuitem', { name: 'Move down' })).toBeDisabled();

      // Opening focuses the first enabled action (Duplicate). ArrowUp skips the
      // two disabled entries and wraps to Delete, which opens its confirmation.
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
      const deleteDialog = page.getByRole('dialog', { name: 'Delete wishlist?' });
      await expect(deleteDialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(deleteDialog).toBeHidden();

      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();

      await context.close();
    } finally {
      await deleteTestUsers([menuUser.id]);
    }
  });

  test('gives authenticated pages a main landmark and a single level-one heading', async ({
    browser,
  }) => {
    const context = await signIn(browser, user.id);
    const page = await context.newPage();
    await page.goto('/dashboard');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    await context.close();
  });
});
