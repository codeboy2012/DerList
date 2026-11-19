import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createTestCollection,
  createTestUser,
  deleteTestUsers,
  prisma,
  signIn,
  uniqueSuffix,
} from './helpers';

/**
 * The full product editor must show specifications from both the canonical
 * `metadata.specs` key and the legacy `metadata.specifications` key, and must
 * persist a legacy item's specs under the canonical key when saved.
 */
test.describe('product editor specifications', () => {
  let user: { id: string };
  let collection: { id: string };
  let legacyItem: { id: string };
  let canonicalItem: { id: string };
  const stamp = uniqueSuffix();
  const legacyTitle = `Legacy specs product ${stamp}`;
  const canonicalTitle = `Canonical specs product ${stamp}`;

  test.beforeAll(async () => {
    user = await createTestUser('spec-editor');
    collection = await createTestCollection(user.id, `Spec collection ${stamp}`);
    legacyItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collection.id,
        title: legacyTitle,
        position: 0,
        metadata: JSON.stringify({
          specifications: [{ id: 'legacy-1', key: 'Battery', value: '30', unit: 'hours' }],
        }),
      },
      select: { id: true },
    });
    canonicalItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: collection.id,
        title: canonicalTitle,
        position: 1,
        metadata: JSON.stringify({
          specs: [{ id: 'canonical-1', key: 'Weight', value: '250', unit: 'g' }],
        }),
      },
      select: { id: true },
    });
  });

  test.afterAll(async () => {
    await deleteTestUsers([user.id]);
  });

  async function openSpecifications(page: Page, title: string): Promise<Locator> {
    const row = page.locator('article', { hasText: title });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Full product editor' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Edit Product')).toBeVisible();
    await drawer.getByRole('button', { name: /Specifications/ }).click();
    return drawer;
  }

  test('reads legacy specs, saves them canonically, and reads canonical specs', async ({
    browser,
  }) => {
    const context = await signIn(browser, user.id, { viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`/wishlists/${collection.id}`);

    const legacyDrawer = await openSpecifications(page, legacyTitle);
    await expect(legacyDrawer.locator('input[placeholder="e.g. VRAM"]')).toHaveValue('Battery');
    await expect(legacyDrawer.locator('input[placeholder="e.g. 16"]')).toHaveValue('30');
    await expect(legacyDrawer.locator('input[placeholder="GB"]')).toHaveValue('hours');

    await legacyDrawer.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(legacyDrawer).toBeHidden();

    await expect
      .poll(async () => {
        const stored = await prisma.wishlistItem.findUnique({ where: { id: legacyItem.id } });
        const metadata = JSON.parse(stored?.metadata ?? '{}') as {
          specs?: Array<{ key?: string; value?: string; unit?: string }>;
        };
        return metadata.specs?.[0];
      })
      .toMatchObject({ key: 'Battery', value: '30', unit: 'hours' });

    const canonicalDrawer = await openSpecifications(page, canonicalTitle);
    await expect(canonicalDrawer.locator('input[placeholder="e.g. VRAM"]')).toHaveValue('Weight');
    await expect(canonicalDrawer.locator('input[placeholder="e.g. 16"]')).toHaveValue('250');
    await expect(canonicalDrawer.locator('input[placeholder="GB"]')).toHaveValue('g');

    await page.keyboard.press('Escape');
    await expect(canonicalDrawer).toBeHidden();

    await context.close();
  });
});
