import { expect, test } from '@playwright/test';
import {
  createTestCollection,
  createTestUser,
  deleteTestUsers,
  signIn,
  uniqueSuffix,
} from './helpers';

/**
 * The page body already renders "Page not found" for a foreign collection.
 * This asserts the document metadata and the returned HTML do not leak the
 * foreign collection's title or description either.
 */
test.describe('collection metadata privacy', () => {
  let userA: { id: string };
  let userB: { id: string };

  test.beforeAll(async () => {
    userA = await createTestUser('meta-privacy-a');
    userB = await createTestUser('meta-privacy-b');
  });

  test.afterAll(async () => {
    await deleteTestUsers([userA.id, userB.id]);
  });

  test('never exposes a foreign collection title in detail or edit metadata', async ({
    browser,
  }) => {
    const stamp = uniqueSuffix();
    const secretTitle = `Secret Foreign Collection ${stamp}`;
    const secretDescription = `Private description ${stamp}`;
    const collection = await createTestCollection(userB.id, secretTitle, {
      description: secretDescription,
    });

    const contextA = await signIn(browser, userA.id);
    const pageA = await contextA.newPage();

    const detailResponse = await pageA.goto(`/wishlists/${collection.id}`);
    expect(detailResponse?.status()).toBe(200);
    const detailHtml = await detailResponse!.text();

    expect(detailHtml).not.toContain(secretTitle);
    expect(detailHtml).not.toContain(secretDescription);
    // Metadata templates append the site name, so match the generic prefix.
    await expect(pageA).toHaveTitle(/^Wishlist — DerList/);
    await expect(pageA.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

    const editResponse = await pageA.goto(`/wishlists/${collection.id}/edit`);
    expect(editResponse?.status()).toBe(200);
    const editHtml = await editResponse!.text();

    expect(editHtml).not.toContain(secretTitle);
    expect(editHtml).not.toContain(secretDescription);
    await expect(pageA).toHaveTitle(/^Edit Wishlist — DerList/);

    await contextA.close();

    // The owner still gets their real collection and title.
    const contextB = await signIn(browser, userB.id);
    const pageB = await contextB.newPage();
    await pageB.goto(`/wishlists/${collection.id}`);
    await expect(pageB.getByRole('heading', { level: 1, name: secretTitle })).toBeVisible();
    expect(await pageB.title()).toContain(secretTitle);

    await pageB.goto(`/wishlists/${collection.id}/edit`);
    expect(await pageB.title()).toContain(`Edit ${secretTitle}`);

    await contextB.close();
  });
});
