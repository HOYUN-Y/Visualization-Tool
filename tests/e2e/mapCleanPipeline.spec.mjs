// Map must read its built-in datasets through the cleaning pipeline (PLAN §12 F1).
//
// The bug this locks: mapMode read `NODE.datasets.find(...).rows` — the RAW dataset — at six sites,
// making Map the only mode that broke the repo's top rule (README §개발 규칙 2: always read via
// Store.derive.getActiveData). It failed silently: a Clean step applied to district_stats /
// korea_provinces / korea_municipalities / world_gdp never reached the map, so the grid showed cleaned
// values while the map drew the originals, with nothing on screen saying so.
//
// WHAT THIS SPEC ASSERTS, AND WHY IT LOOKS LIKE THIS.
// Two earlier drafts of this file passed against the UNFIXED code and had to be thrown away:
//   1. Asserting getActiveData() vs NODE.datasets in page.evaluate() tests the STORE, not the Map —
//      it passes with or without the bug.
//   2. Driving Map mode without picking a tab tests nothing: the default tab is "mydata"
//      (mapMode.jsx:953), so MapCenter/MapPanel — the components with the seed lookups — never mount.
// So: open the Seoul tab and read the district leaderboard (.maprank), which renders seedRows()'s data
// straight into the DOM. ECharts draws to canvas, but this panel is real DOM and is fed by the same
// call, which makes it the honest place to observe the data path.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

async function openSeoulTab(page) {
  await page.evaluate(() => window.Store.actions.setMode('map'));
  await page.waitForFunction(() => window.Store.getState().mode === 'map', { timeout: 5000 });
  await page.getByRole('button', { name: /서울|Seoul/ }).first().click();
  await page.waitForSelector('.maprank', { timeout: 10000 });
}

test('a Clean step on district_stats reaches the Seoul map leaderboard', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await bootApp(page, { activeId: 'district_stats' });
  await openSeoulTab(page);

  const target = await page.evaluate(() => window.Store.derive.getActiveData('district_stats').rows[0].district);
  await expect(page.locator('.maprank')).toContainText(target); // baseline: the original name is shown

  // Rename that district through the non-destructive cleaning pipeline.
  await page.evaluate((d) => {
    window.Store.actions.addStep({ op: 'replace', col: 'district', params: { from: d, to: 'ZZZ_CLEANED' } });
  }, target);
  await page.waitForTimeout(500);

  // THE ASSERTION: the map's own panel must show the cleaned value. Before the fix it kept showing
  // the raw one, because it read NODE.datasets directly.
  await expect(page.locator('.maprank')).toContainText('ZZZ_CLEANED');
  await expect(page.locator('.maprank')).not.toContainText(target);

  // The raw dataset stays untouched — that's the point of the non-destructive pipeline.
  const rawUntouched = await page.evaluate(
    () => window.NODE.datasets.find((d) => d.id === 'district_stats').rows.every((r) => r.district !== 'ZZZ_CLEANED'));
  expect(rawUntouched).toBe(true);

  expect(pageErrors, `uncaught: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

test('Seoul map survives a deleted seed dataset (getActiveData throws on missing ids)', async ({ page }) => {
  // seedRows() must keep the old `ds ? ds.rows : []` absence guard. Verified directly in-browser:
  // getActiveData('district_stats') on a removed dataset throws "Cannot read properties of undefined
  // (reading 'rows')" — applySteps() dereferences dataset.rows with no null check. These seeds can
  // legitimately be gone (deleted / custom-only project), so dropping the guard turns F1 into a crash.
  //
  // `.app` staying visible is NOT a sufficient assertion: app.jsx wraps each mode in an
  // <ErrorBoundary key={mode}>, so a mode crash renders a fallback INSIDE .app and the shell survives.
  // Assert the fallback's absence, and do it on the Seoul tab where the seed lookup actually runs.
  await bootApp(page, { mode: 'data' });
  await page.evaluate(() => window.Store.actions.removeDataset('district_stats'));
  await page.evaluate(() => window.Store.actions.setMode('map'));
  await page.waitForFunction(() => window.Store.getState().mode === 'map', { timeout: 5000 });
  await page.getByRole('button', { name: /서울|Seoul/ }).first().click();
  await page.waitForTimeout(800);

  await expect(page.getByText('이 화면을 표시하는 중 오류가 발생했습니다')).toHaveCount(0);
  // The panel rendered with an empty leaderboard. Assert PRESENCE, not visibility: with no rows the
  // .maprank div collapses to zero height, which Playwright reports as not visible.
  await expect(page.locator('.maprank')).toHaveCount(1);
  await expect(page.locator('.maprank .mr-row')).toHaveCount(0);
});
