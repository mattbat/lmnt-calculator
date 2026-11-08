import { expect, test } from '@playwright/test';
import { disableWebShare, openAndAccept } from './helpers';

const tabs = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' });

test('make a 30-serving Watermelon batch, log it with notes, and make it again (Q-4)', async ({ page }) => {
  await openAndAccept(page);
  await page.getByRole('link', { name: /Watermelon/ }).click();
  await expect(page.getByRole('heading', { name: 'Watermelon', level: 1 })).toBeVisible();

  const servings = page.getByLabel('Number of servings');
  await servings.fill('12');
  await expect(page.getByTestId('amount-salt')).toHaveText('30.00 g');
  await servings.fill('30');
  await expect(page.getByTestId('amount-salt')).toHaveText('75.00 g');
  await expect(page.getByTestId('amount-stevia')).toHaveText('3.60 g');
  await expect(page.getByText('Not medical advice · Not affiliated with LMNT.')).toBeVisible();

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

test('share a recipe link and add it in a fresh browser (Q-4)', async ({ page, browser }) => {
  await openAndAccept(page);
  // Make a recipe the other side doesn't have: duplicate Raw and rename it.
  await page.goto('./#/recipe/raw/edit');
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Raw (2)');
  await page.getByLabel('Name').fill('Beach Mix');
  await page.getByRole('button', { name: 'Save recipe' }).click();
  await expect(page.getByRole('heading', { name: 'Beach Mix', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Share recipe' }).click();
  const box = page.getByLabel('Recipe link');
  await expect(box).toHaveValue(/#r=/);
  const link = await box.inputValue();
  expect(link).toContain('/lmnt-calculator/#r=');
  expect(link.length).toBeLessThan(1500);

  const other = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const page2 = await other.newPage();
    await page2.goto(link);
    await page2.getByRole('button', { name: 'I understand' }).click();
    await expect(page2.getByRole('heading', { name: 'Beach Mix', level: 1 })).toBeVisible();
    await expect(page2.getByText('Redmond Real Salt')).toBeVisible();
    await expect(page2.getByText('Not medical advice · Not affiliated with LMNT.')).toBeVisible();
    await page2.getByRole('button', { name: 'Add to my recipes' }).click();
    await expect(page2.getByRole('heading', { name: 'Recipe added' })).toBeVisible();
    await page2.getByRole('link', { name: 'Go to my recipes' }).click();
    await expect(page2.getByRole('link', { name: /Beach Mix/ })).toBeVisible();
  } finally {
    await other.close();
  }
});

test('back up, clear site data, and restore (Q-4)', async ({ page }, testInfo) => {
  await disableWebShare(page);
  await openAndAccept(page);

  // Change something so the restore is visible.
  await page.goto('./#/ingredients');
  await page.getByRole('button', { name: 'Edit Redmond Real Salt' }).click();
  await page.getByLabel('Package price').fill('20');
  await page.getByRole('button', { name: 'Save ingredient' }).click();
  await expect(page.getByRole('button', { name: 'Edit Redmond Real Salt' })).toContainText('$20.00');

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
  await page.goto('./#/ingredients');
  await expect(page.getByRole('button', { name: 'Edit Redmond Real Salt' })).toContainText('$11.39');

  await page.goto('./#/more/settings');
  await page.getByLabel('Choose backup file').setInputFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Restore from backup' });
  await expect(sheet).toContainText('3 recipes');
  await sheet.getByRole('button', { name: 'Replace all' }).click();
  await page.getByRole('dialog', { name: 'Replace everything?' }).getByRole('button', { name: 'Replace all' }).click();
  await expect(page.getByText(/Everything was replaced/)).toBeVisible();

  await page.goto('./#/ingredients');
  await expect(page.getByRole('button', { name: 'Edit Redmond Real Salt' })).toContainText('$20.00');
});

test('editing an ingredient price updates the cost per serving (Q-4)', async ({ page }) => {
  await openAndAccept(page);
  const card = page.getByRole('link', { name: /Watermelon/ });
  await expect(card).toContainText('$0.25');

  await tabs(page).getByRole('link', { name: /Ingredients/ }).click();
  await page.getByRole('button', { name: 'Edit Redmond Real Salt' }).click();
  await page.getByLabel('Package price').fill('20');
  await page.getByRole('button', { name: 'Save ingredient' }).click();

  await tabs(page).getByRole('link', { name: /Recipes/ }).click();
  await expect(card).toContainText('$0.28');
  await card.click();
  await expect(page.getByText('Cost per serving').locator('..')).toContainText('$0.28');
});
