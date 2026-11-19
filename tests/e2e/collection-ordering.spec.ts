import { expect, test, type Page } from '@playwright/test';
import { createTestUser, deleteTestUsers, prisma, signIn, uniqueSuffix } from './helpers';

/**
 * Collection ordering is exposed through the per-card action menu, so it must
 * work from the keyboard alone. The menu opens on the first *enabled* item:
 * the first collection has no "Move up" and the last has no "Move down".
 */
test.describe('collection ordering keyboard controls', () => {
  let user: { id: string };
  let first: { id: string; title: string };
  let middle: { id: string; title: string };
  let last: { id: string; title: string };

  test.beforeAll(async () => {
    user = await createTestUser('ordering-e2e');
    const stamp = uniqueSuffix();

    const create = (label: string, sortOrder: number) =>
      prisma.wishlist.create({
        data: {
          ownerId: user.id,
          title: `${label} ${stamp}`,
          slug: `${label.toLowerCase().replace(/\s+/g, '-')}-${stamp}-${sortOrder}`,
          sortOrder,
        },
        select: { id: true, title: true },
      });

    first = await create('Ordering first', 0);
    middle = await create('Ordering middle', 1);
    last = await create('Ordering last', 2);
  });

  test.afterAll(async () => {
    await deleteTestUsers([user.id]);
  });

  async function currentOrder(): Promise<Array<{ id: string; sortOrder: number }>> {
    return prisma.wishlist.findMany({
      where: { ownerId: user.id, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, sortOrder: true },
    });
  }

  const positionOf = async (id: string) =>
    (await currentOrder()).findIndex((wishlist) => wishlist.id === id);

  function actionsTrigger(page: Page, title: string) {
    return page.getByRole('button', { name: `Actions for ${title}` });
  }

  test('moves with Enter, Space and arrow keys, and refuses disabled actions', async ({
    browser,
  }) => {
    const context = await signIn(browser, user.id, { viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto('/wishlists');

    const menu = page.getByRole('menu');

    // First collection: "Move up" is unavailable and the menu opens on the
    // first enabled action instead.
    const firstTrigger = actionsTrigger(page, first.title);
    await firstTrigger.focus();
    await page.keyboard.press('Enter');

    await expect(menu).toBeVisible();
    await expect(menu).toBeFocused();
    await expect(menu.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: 'Move down' })).toBeEnabled();

    // Enter activates the focused first-enabled item, which is "Move down".
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect.poll(() => positionOf(first.id)).toBe(1);
    await expect(firstTrigger).toBeFocused();

    // The same card now reports "Move up" first; Space activates it.
    await page.keyboard.press('Space');
    await expect(menu).toBeVisible();

    // Opening while the previous action is still settling must still leave a
    // roving tab stop on an enabled item once that action finishes.
    const moveUp = menu.getByRole('menuitem', { name: 'Move up' });
    await expect(moveUp).toBeEnabled();
    await expect(moveUp).toHaveAttribute('tabindex', '0');

    await page.keyboard.press('Space');
    await expect(menu).toBeHidden();
    await expect.poll(() => positionOf(first.id)).toBe(0);
    await expect(firstTrigger).toBeFocused();

    // Last collection: "Move down" is unavailable, "Move up" is not.
    const lastTrigger = actionsTrigger(page, last.title);
    await lastTrigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu).toBeVisible();
    await expect(menu).toBeFocused();
    await expect(menu.getByRole('menuitem', { name: 'Move up' })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: 'Move down' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(lastTrigger).toBeFocused();

    // A disabled action must not run, even if a click event is dispatched at it.
    await firstTrigger.focus();
    await page.keyboard.press('Enter');
    const disabledMoveUp = menu.getByRole('menuitem', { name: 'Move up' });
    await expect(disabledMoveUp).toBeDisabled();
    await disabledMoveUp.dispatchEvent('click');
    await page.waitForTimeout(500);
    expect(await positionOf(first.id)).toBe(0);
    expect(await positionOf(middle.id)).toBe(1);
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(firstTrigger).toBeFocused();

    await context.close();
  });
});
