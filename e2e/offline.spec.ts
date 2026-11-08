import { expect, test } from '@playwright/test';

test('launches with no internet after the first visit (T4)', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Recipes' })).toBeVisible();

  // Wait until the service worker has cached the app and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('LMNT Calculator');
  await expect(page.getByRole('heading', { name: 'Recipes' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await context.setOffline(false);
});
