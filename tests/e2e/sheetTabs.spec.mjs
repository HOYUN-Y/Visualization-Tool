// The Chart / Pivot / Dashboard tab bars were three near-identical components collapsed into one shared
// window.SheetTabs (PLAN §12 F5). This locks the behavior that dedup must preserve — add, rename,
// duplicate, close — driven through the real DOM in each of the three modes, since a shared component
// is exactly where a wrong prop wire-up (e.g. pivot's add firing viz's action) would hide.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

// Each mode: (rail mode id, store selector for the sheet list, add-button title).
const MODES = [
  { mode: 'visualize', sheetsPath: 's => s.vizSheets', addTitle: '새 시각화 탭' },
  { mode: 'pivot', sheetsPath: 's => s.pivotSheets', addTitle: '새 피벗 탭' },
  { mode: 'dashboard', sheetsPath: 's => s.dash.sheets', addTitle: '새 대시보드' },
];

for (const M of MODES) {
  test(`${M.mode}: SheetTabs add / rename / duplicate / close drive the right store slice`, async ({ page }) => {
    const count = () => page.evaluate((p) => (new Function('s', 'return (' + p + ')(s)'))(window.Store.getState()).length, M.sheetsPath);

    await bootApp(page, { mode: M.mode });
    await page.waitForSelector('.viz-tabs', { timeout: 8000 });
    const n0 = await count();

    // ADD → one more sheet, in THIS mode's slice.
    await page.locator(`.viz-tab-add[title="${M.addTitle}"]`).click();
    await page.waitForTimeout(300);
    expect(await count(), 'add should grow this mode\'s sheet list').toBe(n0 + 1);

    // DUPLICATE the active tab → one more again.
    await page.locator('.viz-tab.on .viz-tab-dup').first().click();
    await page.waitForTimeout(300);
    expect(await count(), 'duplicate should add a sheet').toBe(n0 + 2);

    // RENAME the active tab via double-click → input → Enter.
    await page.locator('.viz-tab.on').first().dblclick();
    const input = page.locator('.viz-tab-edit');
    await expect(input).toBeVisible();
    await input.fill('RENAMED_TAB');
    await input.press('Enter');
    await page.waitForTimeout(300);
    await expect(page.locator('.viz-tab.on .viz-tab-nm')).toHaveText('RENAMED_TAB');

    // CLOSE tabs back down to one → the close buttons disappear at count 1.
    for (let i = 0; i < 5 && (await count()) > 1; i++) {
      await page.locator('.viz-tab.on .viz-tab-x').first().click();
      await page.waitForTimeout(200);
    }
    expect(await count(), 'closing should reduce to a single sheet').toBe(1);
    await expect(page.locator('.viz-tab-x')).toHaveCount(0); // last tab is not closable
  });
}
