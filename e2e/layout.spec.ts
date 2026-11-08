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

// The iPhone launch bug: an installed app reports a viewport ~48pt short until
// the page scrolls. The app must size itself from the screen instead, so the tab
// bar ends at the real bottom edge (874), not the short viewport's (826).
test.describe('installed iPhone app with a short viewport at launch', () => {
  test.use({ viewport: { width: 402, height: 826 }, screen: { width: 402, height: 874 } });

  test('the frame fills the whole screen and the tab bar sits on its bottom edge', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }));
    await openAndAccept(page);
    const m = await page.evaluate(() => ({
      appH: document.querySelector('.app')!.getBoundingClientRect().height,
      tabBottom: document.querySelector('.tabbar')!.getBoundingClientRect().bottom,
    }));
    expect(Math.round(m.appH)).toBe(874);
    expect(Math.round(m.tabBottom)).toBe(874);
  });
});
