import { expect, test } from '@playwright/test';
import { disableWebShare, openAndAccept } from './helpers';

const tabs = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' });

test('make a 30-serving Watermelon batch, log it with notes, and make it again (Q-4)', async ({ page }) => {
  await openAndAccept(page);
  await page.getByRole('link', { name: /Watermelon/ }).click();
  await expect(page.getByRole('heading', { name: 'Watermelon', level: 1 })).toBeVisible();

  // Start mixing is reachable without scrolling (the viewport is the phone's).
  const viewport = page.viewportSize()!;
  const box = (await page.getByRole('button', { name: 'Start mixing' }).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

  const servings = page.getByLabel('Number of servings');
  await servings.fill('12');
  await expect(page.getByTestId('amount-salt')).toHaveText('30.00 g');
  await servings.fill('30');
  await expect(page.getByTestId('amount-salt')).toHaveText('75.00 g');
  await expect(page.getByTestId('amount-stevia')).toHaveText('3.60 g');
  await expect(page.getByText('Not medical advice · Not affiliated with LMNT.')).toBeVisible();

  const label = page.getByRole('region', { name: 'Electrolytes per serving' });
  await expect(label).toContainText('Sodium 950 mg');
  await expect(label).toContainText('41%');

  await page.getByRole('button', { name: 'Start mixing' }).click();
  await expect(page.getByRole('heading', { name: 'Redmond Real Salt' })).toBeVisible();
  await expect(tabs(page)).toBeHidden();
  await expect(page.getByTestId('target')).toHaveText('75.00 g');

  // A reload resumes on the same step (M6).
  await page.getByRole('button', { name: 'Done → next' }).click();
  await expect(page.getByRole('heading', { name: 'Magnesium malate' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Magnesium malate' })).toBeVisible();

  // Six ingredients in total; two done, so four more, then the Mix step.
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Done → next' }).click();
  await expect(page.getByRole('heading', { name: 'Mix', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Done → next' }).click();
  await expect(page.getByRole('heading', { name: 'Fill', level: 2 })).toBeVisible();
  await expect(page.getByText('Fill 30 vials with 5.30 g each.')).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page.getByRole('heading', { name: 'Batch logged' })).toBeVisible();
  await page.getByLabel(/Notes/).fill('Tastes like summer');
  await page.getByRole('button', { name: 'Save notes and view log' }).click();

  await expect(page.getByRole('heading', { name: 'Log', level: 1 })).toBeVisible();
  const row = page.getByRole('link', { name: /Watermelon/ });
  await expect(row).toContainText('30 servings');
  await expect(row).toContainText('Tastes like summer');
  await row.click();
  await expect(page.getByLabel('Notes')).toHaveValue('Tastes like summer');
  await page.getByRole('button', { name: 'Make again' }).click();

  await expect(page.getByRole('heading', { name: 'Watermelon', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Number of servings')).toHaveValue('30');
});

test('share a recipe link and open it in a fresh browser (Q-4)', async ({ page, browser }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', {
      value: async (data: unknown) => {
        w.__shared.push(data);
      },
      configurable: true,
    });
  });
  await openAndAccept(page);
  await page.getByRole('link', { name: /Watermelon/ }).click();
  await page.getByRole('button', { name: 'Share recipe' }).click();
  await expect(page.getByText('Shared.')).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { __shared: { url: string }[] }).__shared);
  const link = shared[0]!.url;
  expect(link).toMatch(/\/lmnt-calculator\/#\/recipe\/watermelon$/);

  const other = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const page2 = await other.newPage();
    await page2.goto(link);
    await expect(page2.getByRole('heading', { name: 'Before you start' })).toBeVisible();
    await page2.getByRole('button', { name: 'I understand' }).click();
    await expect(page2.getByRole('heading', { name: 'Watermelon', level: 1 })).toBeVisible();
    await expect(page2.getByTestId('amount-salt')).toHaveText('75.00 g');
    await expect(page2.getByText('Not medical advice · Not affiliated with LMNT.')).toBeVisible();
  } finally {
    await other.close();
  }
});

test('back up, clear site data, and restore (Q-4)', async ({ page }, testInfo) => {
  await disableWebShare(page);
  await openAndAccept(page);

  // Change a setting so the restore is visible.
  await page.goto('./#/more/settings');
  await page.getByRole('radio', { name: 'Ounces' }).click();
  await page.goto('./#/recipe/watermelon');
  await expect(page.getByTestId('amount-salt')).toHaveText('2.646 oz');

  await page.goto('./#/more/settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Back up now' }).click(),
  ]);
  const file = testInfo.outputPath('backup.json');
  await download.saveAs(file);
  await expect(page.getByText(/Backup file downloaded/)).toBeVisible();

  // Clear site data: delete the database and local storage, then reload.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        localStorage.clear();
        const request = indexedDB.deleteDatabase('lmnt-calculator');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
  await page.goto('./');
  await page.reload();
  await page.getByRole('button', { name: 'I understand' }).click();
  await page.goto('./#/recipe/watermelon');
  await expect(page.getByTestId('amount-salt')).toHaveText('75.00 g');

  await page.goto('./#/more/settings');
  await page.getByLabel('Choose backup file').setInputFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Restore from backup' });
  await sheet.getByRole('button', { name: 'Replace all' }).click();
  await page.getByRole('dialog', { name: 'Replace everything?' }).getByRole('button', { name: 'Replace all' }).click();
  await expect(page.getByText(/Everything was replaced/)).toBeVisible();

  await page.goto('./#/recipe/watermelon');
  await expect(page.getByTestId('amount-salt')).toHaveText('2.646 oz');
});

test('ingredients shows the built-in prices read-only (Q-4)', async ({ page }) => {
  await openAndAccept(page);
  await tabs(page).getByRole('link', { name: /Ingredients/ }).click();
  await expect(page.getByRole('heading', { name: 'Ingredients', level: 1 })).toBeVisible();
  const salt = page.getByRole('listitem').filter({ hasText: 'Redmond Real Salt' });
  await expect(salt).toContainText('$11.39');
  await expect(salt).toContainText('/g');
  await expect(page.getByRole('button', { name: /Edit|Delete|Add/ })).toHaveCount(0);
});

test('an old pasted-recipe link just opens the recipes list (Q-4)', async ({ page }) => {
  await openAndAccept(page);
  await page.goto('./#r=abc');
  await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible();
});

test('the backup reminder can be put off with Not now (Q-4)', async ({ page }) => {
  await openAndAccept(page);
  // Log a batch by hand so the reminder shows up.
  await tabs(page).getByRole('link', { name: /Log/ }).click();
  await page.getByRole('button', { name: '+ Log a batch by hand' }).click();
  await page.getByRole('dialog', { name: 'Log a batch' }).getByRole('button', { name: 'Save to log' }).click();
  await expect(page.getByLabel('Notes')).toBeVisible();
  await tabs(page).getByRole('link', { name: /Recipes/ }).click();
  await expect(page.getByText('Time for a backup')).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByText('Time for a backup')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible();
  await expect(page.getByText('Time for a backup')).toBeHidden();
});
