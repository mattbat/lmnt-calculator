import { expect, test } from '@playwright/test';

test('loads with the tab bar and title', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('LMNT Calculator');
  const tabs = page.getByRole('navigation', { name: 'Main' });
  await expect(tabs).toBeVisible();
  for (const label of ['Recipes', 'Log', 'Ingredients', 'More']) {
    await expect(tabs.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Recipes' })).toBeVisible();
});

test('tabs switch screens', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Log/ }).click();
  await expect(page.getByRole('heading', { name: 'Log' })).toBeVisible();
  await expect(page.getByText('Coming soon')).toBeVisible();
});
