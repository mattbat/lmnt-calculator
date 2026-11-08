import { expect, test } from '@playwright/test';
import { openAndAccept } from './helpers';

test('shows the first-launch notice, then the tab bar and title (D1)', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('LMNT Calculator');
  await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  await page.getByRole('button', { name: 'I understand' }).click();
  const tabs = page.getByRole('navigation', { name: 'Main' });
  await expect(tabs).toBeVisible();
  for (const label of ['Recipes', 'Log', 'Ingredients', 'More']) {
    await expect(tabs.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible();
  for (const name of ['Raw', 'Lemon', 'Watermelon']) {
    await expect(page.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
  }
});

test('the notice does not come back after a reload', async ({ page }) => {
  await openAndAccept(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I understand' })).toHaveCount(0);
});

test('tabs switch screens', async ({ page }) => {
  await openAndAccept(page);
  const tabs = page.getByRole('navigation', { name: 'Main' });
  await tabs.getByRole('link', { name: /Log/ }).click();
  await expect(page.getByRole('heading', { name: 'Log', level: 1 })).toBeVisible();
  await expect(page.getByText('No batches yet')).toBeVisible();
  await tabs.getByRole('link', { name: /Ingredients/ }).click();
  await expect(page.getByRole('heading', { name: 'Ingredients', level: 1 })).toBeVisible();
  await tabs.getByRole('link', { name: /More/ }).click();
  await expect(page.getByRole('heading', { name: 'More', level: 1 })).toBeVisible();
});
