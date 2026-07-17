// A formula column must be able to reference Korean / spaced column names (PLAN §12 B3′). This app's
// domain is Korean apartment data, so `row["가격"]`-style access is table stakes. The FormulaEval engine
// already supports it (locked in tests/formulaEval.test.js); this drives the real Clean-mode UI path
// end-to-end — add a formula step through the store and confirm the derived column is computed and typed.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test('a formula column over Korean columns computes through the real Clean pipeline', async ({ page }) => {
  await bootApp(page, { mode: 'data' });

  // Register a dataset with Korean + spaced column names, make it active.
  await page.evaluate(() => {
    const rows = [{ '가격': 100, '면적 (m²)': 30 }, { '가격': 150, '면적 (m²)': 40 }];
    window.Store.actions.registerDataset({
      id: 'krformula', name: 'krformula', short: 'krformula', icon: 'table', source: 'test', rows,
      columns: [
        { key: '가격', label: '가격', type: 'integer', role: 'measure' },
        { key: '면적 (m²)', label: '면적 (m²)', type: 'integer', role: 'measure' },
      ],
    }, { activate: true });
    window.Store.actions.setMode('clean');
  });
  await page.waitForFunction(() => window.Store.getState().mode === 'clean', { timeout: 5000 });

  // Add a formula column: 평단가 = 가격 / 면적, referencing a dotted Korean name and a bracketed spaced one.
  await page.evaluate(() => {
    window.Store.actions.addStep({ op: 'formula', params: { name: '평단가', expr: 'row.가격 / row["면적 (m²)"]' } });
  });
  await page.waitForTimeout(400);

  // The derived column must exist with computed values (100/20=5, 200/40=5).
  const result = await page.evaluate(() => {
    const { rows, columns } = window.Store.derive.getActiveData('krformula');
    return {
      hasCol: columns.some((c) => c.key === '평단가'),
      values: rows.map((r) => r['평단가']),
      type: (columns.find((c) => c.key === '평단가') || {}).type,
    };
  });
  expect(result.hasCol, 'derived Korean-named column must be added').toBe(true);
  // 100/30 = 3.333…, 150/40 = 3.75 — both floats.
  expect(result.values[0]).toBeCloseTo(100 / 30, 6);
  expect(result.values[1]).toBeCloseTo(3.75, 6);
  expect(result.type).toBe('float');

  // The Clean grid must actually render the new column header.
  await expect(page.locator('.dg-head, .datagrid, table').first()).toContainText('평단가');

  // tidy
  await page.evaluate(() => { window.Store.actions.setActive('seoul_txns'); window.Store.actions.removeDataset('krformula'); });
});

test('the Formula UI hint shows the bracket syntax for Korean columns', async ({ page }) => {
  // Discoverability: a Korean-data user seeing only `row.area` would not know how to reference 가격.
  await bootApp(page, { activeId: 'seoul_txns', mode: 'clean' });
  // The right-panel hint must mention bracket access with a Korean example.
  await expect(page.getByText('row["가격"]', { exact: false })).toBeVisible();
});
