import { expect, test } from '@playwright/test';
import { openAndAccept } from './helpers';

// Phone-test feedback (2026-11-08): the tab bar must sit on the bottom edge from
// the first frame, the page itself never scrolls, and the main screens fit on an
// iPhone 17-sized screen without scrolling.
const FITS = ['./', './#/recipe/watermelon', './#/recipe/lemon', './#/recipe/raw', './#/mix/watermelon', './#/log', './#/ingredients', './#/more', './#/more/settings', './#/more/about'];

test('the tab bar sits on the bottom edge and the main screens fit without scrolling', async ({ page }) => {
  await openAndAccept(page);
  const viewport = page.viewportSize()!;
  for (const path of FITS) {
    await page.goto(path);
    await expect(page.locator('main.screen')).toBeVisible();
    const m = await page.evaluate(() => {
      const screen = document.querySelector('main.screen')!;
      const tabbar = document.querySelector('.tabbar');
      return {
        overflow: screen.scrollHeight - screen.clientHeight,
        pageScroll: document.scrollingElement!.scrollHeight - window.innerHeight,
        tabBottom: tabbar ? tabbar.getBoundingClientRect().bottom : null,
      };
    });
    expect(m.pageScroll, `${path}: the page itself scrolls`).toBeLessThanOrEqual(0);
    expect(m.overflow, `${path}: content overflows by ${m.overflow}px`).toBeLessThanOrEqual(1);
    if (m.tabBottom !== null) expect(Math.round(m.tabBottom), `${path}: tab bar bottom`).toBe(viewport.height);
  }
});
