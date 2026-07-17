// C1 prerequisite (c): mid-mount reactivity to cleaning + dataset-list changes (PLAN §12 C1).
//
// Fine-grained subscriptions (useSyncExternalStore) mean a component only re-renders when ITS selected
// slice changes. Components that read DERIVED data (getActiveData, depends on state.clean) or the
// non-reactive dataset LIST (NODE.datasets) used to rely on the global re-render to refresh. The fix
// routes those through useActiveData / useDatasets, which subscribe to the right dependencies. These
// tests lock that: a clean step / a dataset registration, applied WHILE a component is mounted, must be
// reflected — otherwise stale data silently returns (the exact regression that reverted the first C1).
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

// The showstopper: the mode you actually clean IN must update its own grid/issue bar on addStep.
test('Clean mode reflects a clean step added while it is mounted', async ({ page }) => {
  await bootApp(page, { activeId: 'seoul_txns', mode: 'clean' });
  await page.waitForSelector('.issue-meta', { timeout: 8000 });

  const rowsBefore = await page.evaluate(() => window.Store.derive.getActiveData('seoul_txns').rows.length);
  const shownBefore = Number((await page.locator('.issue-meta .mono').first().textContent()).replace(/[^\d]/g, ''));
  expect(shownBefore).toBe(rowsBefore);

  // drop_missing on built_year removes rows with null built_year (seoul_txns has injected nulls).
  await page.evaluate(() => window.Store.actions.addStep({ op: 'drop_missing', col: 'built_year' }));
  await page.waitForTimeout(400);

  const rowsAfter = await page.evaluate(() => window.Store.derive.getActiveData('seoul_txns').rows.length);
  expect(rowsAfter, 'drop_missing should actually remove rows').toBeLessThan(rowsBefore);

  const shownAfter = Number((await page.locator('.issue-meta .mono').first().textContent()).replace(/[^\d]/g, ''));
  expect(shownAfter, 'Clean issue bar must show the post-step row count, not the stale one').toBe(rowsAfter);
});

// StatusBar reads useActiveData and is always mounted — a clean step must update its row count even
// though we're in a mode (Stats) that doesn't itself subscribe to `clean`.
test('StatusBar row count updates on a clean step from another mode', async ({ page }) => {
  await bootApp(page, { activeId: 'seoul_txns', mode: 'stats' });
  await page.waitForSelector('.statusbar', { timeout: 8000 });

  const before = await page.evaluate(() => window.Store.derive.getActiveData('seoul_txns').rows.length);
  await page.evaluate(() => window.Store.actions.addStep({ op: 'drop_missing', col: 'area_m2' }));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.Store.derive.getActiveData('seoul_txns').rows.length);
  expect(after).toBeLessThan(before);

  // The StatusBar text contains the row count; it must reflect the new value.
  await expect(page.locator('.statusbar')).toContainText(String(after));
});

// useDatasets: registering a dataset must grow the Data-mode explorer list without a mode switch.
test('Data explorer list grows when a dataset is registered while mounted', async ({ page }) => {
  await bootApp(page, { mode: 'data' });
  await page.waitForSelector('.ds-row', { timeout: 8000 });

  const before = await page.locator('.ds-row').count();
  await page.evaluate(() => {
    const rows = [{ a: 1 }, { a: 2 }];
    window.Store.actions.registerDataset({
      id: 'reactiveprobe', name: 'reactiveprobe', short: 'reactiveprobe', icon: 'table', source: 'test',
      rows, columns: [{ key: 'a', label: 'a', type: 'integer', role: 'measure' }],
    }, { activate: false }); // activate:false → only datasetsRev changes, not activeId
  });
  await page.waitForTimeout(400);

  const after = await page.locator('.ds-row').count();
  expect(after, 'explorer must show the new dataset (useDatasets subscribes to datasetsRev)').toBe(before + 1);

  // tidy
  await page.evaluate(() => window.Store.actions.removeDataset('reactiveprobe'));
});
