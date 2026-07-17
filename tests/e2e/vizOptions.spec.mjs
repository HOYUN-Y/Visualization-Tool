// buildOption/applyFormat were extracted from vizMode.jsx into js/vizOptions.js (PLAN §12 F3). The
// functions are browser-only (they read Charts.themeColors()/palette() and NODE formatters at call
// time), so this E2E is their regression net: every one of the 20 chart types must still produce a
// renderable ECharts option, and applyVizFormat must still post-process one without throwing.
//
// During the extraction a byte-for-byte snapshot of all 20 outputs was compared before/after the move
// and came back identical; this spec keeps that surface covered going forward.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';
import { ALL_TYPES, buildCtx } from './_vizTypes.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test('window.buildVizOption + applyVizFormat exist and cover all 20 chart types', async ({ page }) => {
  await bootApp(page, { mode: 'visualize' });

  const result = await page.evaluate(({ types, ctxSrc }) => {
    const makeCtx = new Function('type', 'return (' + ctxSrc + ')(type)');
    const out = { hasBuild: typeof window.buildVizOption === 'function', hasFormat: typeof window.applyVizFormat === 'function', perType: {} };
    for (const t of types) {
      try {
        const opt = window.buildVizOption(t, makeCtx(t));
        // A renderable ECharts option is a non-null object with at least a series or a graphic (the
        // "no data" placeholder path also returns an object).
        const ok = opt && typeof opt === 'object' && ('series' in opt || 'graphic' in opt || 'xAxis' in opt);
        // applyVizFormat must accept it (with an empty format) and return an object, not throw.
        const formatted = window.applyVizFormat(opt, {});
        out.perType[t] = ok && formatted && typeof formatted === 'object' ? 'ok' : 'bad-shape';
      } catch (e) {
        out.perType[t] = 'THREW: ' + e.message;
      }
    }
    return out;
  }, { types: ALL_TYPES, ctxSrc: buildCtx.toString() });

  expect(result.hasBuild, 'window.buildVizOption must be defined').toBe(true);
  expect(result.hasFormat, 'window.applyVizFormat must be defined').toBe(true);

  const failures = Object.entries(result.perType).filter(([, v]) => v !== 'ok');
  expect(failures, `chart types failing: ${JSON.stringify(failures)}`).toHaveLength(0);
  expect(Object.keys(result.perType)).toHaveLength(20);
});

test('a real Chart render still works end-to-end after the extraction', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // Drive the actual Chart mode with the seed dataset and a simple bar spec through the store.
  await bootApp(page, { activeId: 'seoul_txns', mode: 'visualize' });
  await page.evaluate(() => {
    const s = window.Store.getState();
    const cols = window.Store.derive.getActiveData(s.activeId).columns;
    const dim = cols.find((c) => c.role === 'dimension' && (c.type === 'category'));
    const meas = cols.find((c) => c.role === 'measure');
    window.Store.actions.setViz({ type: 'bar', cols: [dim], rows: [{ ...meas, agg: 'sum', id: meas.key + '_sum' }], color: null, filters: [], sortDesc: false, topN: 0 });
  });
  await page.waitForTimeout(800);

  // The ECharts canvas must be present and nothing threw.
  await expect(page.locator('.app canvas').first()).toBeVisible();
  expect(pageErrors, `uncaught: ${pageErrors.join(' | ')}`).toHaveLength(0);
});
