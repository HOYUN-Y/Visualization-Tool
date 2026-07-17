// The Ask Insight dataset profile must not silently skip columns (PLAN §12 E2).
//
// profileDataset() used `numCols.slice(0, 6)` for BOTH skewness and correlation, so a dataset's 7th
// numeric column onward was never examined — yet the panel is titled "Dataset profile" and its first
// line counts every column, so the reader takes the silence for "nothing found". Fix: skewness now
// scans all columns (it's O(n) and cheaper than the outlier scan this file already runs uncapped);
// correlation stays capped (O(k²) in columns) but now SAYS it truncated and points at Stats.
//
// profileDataset reads window.Store/NODE/SM, so it can only run in the browser — hence an E2E rather
// than a Node test. We register a synthetic dataset with a skewed 8th column to prove it's reached.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test('profile reaches numeric columns past the 6th and flags truncation', async ({ page }) => {
  await bootApp(page, { mode: 'data' });

  // Build a 9-numeric-column dataset. Columns 1-6 are boring (near-symmetric); column 8 ("late_skew")
  // is strongly right-skewed. Under the old cap, late_skew (index 7) is never checked.
  const findings = await page.evaluate(() => {
    const cols = [];
    for (let i = 1; i <= 9; i++) cols.push({ key: 'n' + i, label: 'n' + i, type: 'float', role: 'measure', agg: 'avg' });
    // rename the 8th to make the finding legible
    cols[7].key = 'late_skew'; cols[7].label = 'late_skew';
    const rows = [];
    for (let r = 0; r < 120; r++) {
      const row = {};
      for (let i = 1; i <= 9; i++) row['n' + i] = (r % 11) - 5; // symmetric-ish, low skew
      // heavy right tail on the 8th column: mostly 0, a few very large
      row['late_skew'] = r % 20 === 0 ? 500 + r : 1;
      rows.push(row);
    }
    const ds = { id: 'skewprobe', name: 'skewprobe', short: 'skewprobe', icon: 'table', source: 'test', rows, columns: cols };
    window.Store.actions.registerDataset(ds, { activate: true });
    return window.IE.profileDataset('skewprobe');
  });

  const text = findings.join('\n');

  // The 8th column's skew MUST be surfaced — this is the row the old cap dropped.
  expect(text).toContain('late_skew');
  expect(text).toMatch(/skew/i);

  // And with 9 numeric columns > the correlation cap of 6, the profile must disclose the truncation
  // rather than imply full coverage.
  expect(text).toMatch(/first 6 of 9/i);
  expect(text).toMatch(/Stats/);
});

test('profile does NOT show a truncation notice when all columns fit', async ({ page }) => {
  // Guard against crying wolf: district_stats has few numeric columns, well under the cap.
  await bootApp(page, { activeId: 'district_stats', mode: 'data' });
  const findings = await page.evaluate(() => window.IE.profileDataset('district_stats'));
  const text = findings.join('\n');
  expect(text).not.toMatch(/first \d+ of \d+/i);
});
