import { expect, type Page } from '@playwright/test';

/** Opens the app and acknowledges the first-launch notice (D1). */
export async function openAndAccept(page: Page, path = './'): Promise<void> {
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand' }).click();
  await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible();
}

/** Forces file download instead of the share sheet, so tests can capture backups. */
export async function disableWebShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
}
