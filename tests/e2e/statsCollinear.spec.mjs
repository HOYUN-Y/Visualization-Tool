// Perfect collinearity in Stats › Regression must be REPORTED, not silently answered.
//
// The bug this locks: js/statsMath.js matInverse used `const piv = A[c][c] || 1e-9`, so a zero pivot
// was replaced with 1e-9 and (XtX)^-1 came back as huge-but-finite garbage. regression() feeds that
// straight into standard errors, so exact collinearity rendered a normal-looking coefficient table with
// se ≈ 1e7 → t ≈ 0 → p ≈ 1: a confident "this predictor is not significant" about a predictor the model
// cannot identify at all. Wrong answers are worse than errors — matInverse now returns null and
// regression throws { code: "collinear" }.
//
// The path is reachable through the real UI: Clean's dummy_encode emits a column for EVERY level
// (store.jsx, no drop-first) and regression prepends an intercept, so regressing on all levels of a
// dummy-encoded category makes XtX exactly singular — the dummy variable trap.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(90000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test('window.SM survives the dual-mode export and reports singularity', async ({ page }) => {
  await bootApp(page);
  // statsMath.js is loaded as a plain <script>; adding `module.exports` for Node tests must not break
  // the browser global. Guard both halves of that contract.
  const r = await page.evaluate(() => ({
    hasSM: !!window.SM,
    hasFns: !!(window.SM && window.SM.matInverse && window.SM.tP && window.SM.chiP),
    wellConditioned: window.SM.matInverse([[4, 7], [2, 6]]),
    singular: window.SM.matInverse([[1, 2], [2, 4]]),
  }));
  expect(r.hasSM).toBe(true);
  expect(r.hasFns).toBe(true);
  expect(r.wellConditioned).not.toBeNull();
  expect(r.singular).toBeNull();
});

test('regression on all levels of a dummy-encoded category reports collinearity instead of a fake table', async ({ page }) => {
  await bootApp(page, { activeId: 'seoul_txns', mode: 'clean' });

  // Dummy-encode building_type (아파트/오피스텔/빌라) → one 0/1 column per level, summing to 1 per row.
  await page.evaluate(() => window.Store.actions.addStep({ op: 'dummy_encode', col: 'building_type' }));
  const dummies = await page.evaluate(() => {
    const { columns } = window.Store.derive.getActiveData('seoul_txns');
    return columns.filter((c) => c.key.startsWith('building_type_')).map((c) => c.key);
  });
  expect(dummies.length).toBeGreaterThanOrEqual(3); // need >= 3 levels for the trap to be exact

  // Regress price on EVERY dummy level — with the intercept regression() adds, XtX is exactly singular.
  await page.evaluate((preds) => {
    window.Store.actions.setMode('stats');
    window.Store.actions.setUI({ stats: { test: 'regression', target: 'price_manwon', preds } });
  }, dummies);
  await page.waitForFunction(() => window.Store.getState().mode === 'stats', { timeout: 5000 });
  await page.waitForTimeout(600);

  // The dedicated collinearity notice must appear...
  await expect(page.getByText('예측변수가 완전 공선 상태입니다')).toBeVisible();

  // ...and crucially, NO coefficient table — the old code rendered one full of confident nonsense.
  await expect(page.locator('.coef-table')).toHaveCount(0);

  // The generic "pick a category with 2+ groups" fallback would be actively misleading here.
  await expect(page.getByText('그룹이 2개 이상인 범주 컬럼과 숫자 측정값을 선택했는지 확인하세요')).toHaveCount(0);
});

test('a healthy multi-predictor regression still renders its coefficient table', async ({ page }) => {
  // Guard against over-triggering: the singularity check must not reject well-conditioned models.
  await bootApp(page, { activeId: 'seoul_txns', mode: 'stats' });
  await page.evaluate(() => {
    window.Store.actions.setUI({ stats: { test: 'regression', target: 'price_manwon', preds: ['area_m2', 'floor'] } });
  });
  await page.waitForTimeout(600);

  await expect(page.locator('.coef-table')).toBeVisible();
  await expect(page.getByText('예측변수가 완전 공선 상태입니다')).toHaveCount(0);

  // Standard errors must be real numbers, not the 1e7-scale garbage the fudged pivot produced.
  const ses = await page.locator('.coef-table tbody tr td:nth-child(3)').allTextContents();
  expect(ses.length).toBeGreaterThan(0);
  for (const s of ses) expect(s.trim()).not.toBe('—');
});
