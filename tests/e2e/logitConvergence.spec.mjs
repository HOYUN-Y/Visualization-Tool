// Logistic regression must WARN when it didn't converge (PLAN §12 E5).
//
// The engine used a fixed 200/400-iteration GD loop whose comment claimed "converged weights". On
// perfectly separable classes the MLE diverges — weights grow without bound — so the coefficient bar
// chart reflected the iteration count, not the data, and probabilities were under-confident, with
// nothing telling the user. fit() now reports `converged`; this spec proves the ML panel surfaces it.
//
// Engine behaviour (converged flag, early stop, no-drift) is locked in tests/logistic.test.js; this is
// the UI wiring: separable data → banner shown; overlapping data → banner absent.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

const WARN = /Training hit the iteration limit|학습이 반복 한도에서 멈췄고/;

async function registerAndTrainLogit(page, sep) {
  // Register a synthetic binary-target dataset, activate it, then drive the real Train button.
  await page.evaluate((separable) => {
    const rows = [];
    for (let i = 0; i < 80; i++) {
      const x = (i - 40) / 8;
      // separable: x sign decides class. overlapping: class alternates independent of x.
      const cls = separable ? (x > 0 ? 'hi' : 'lo') : (i % 2 ? 'hi' : 'lo');
      rows.push({ x, y2: (i % 7) - 3, cls });
    }
    const ds = {
      id: 'logitprobe', name: 'logitprobe', short: 'logitprobe', icon: 'table', source: 'test',
      rows,
      columns: [
        { key: 'x', label: 'x', type: 'float', role: 'measure', agg: 'avg' },
        { key: 'y2', label: 'y2', type: 'float', role: 'measure', agg: 'avg' },
        { key: 'cls', label: 'cls', type: 'category', role: 'dimension' },
      ],
    };
    window.Store.actions.registerDataset(ds, { activate: true });
    window.Store.actions.setMode('ml');
  }, sep);
  await page.waitForFunction(() => window.Store.getState().mode === 'ml', { timeout: 5000 });
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: /Logistic \+ ROC/ }).click();
  await page.waitForTimeout(300);
  // Target must be the binary category; force it so the test doesn't depend on eligibility defaults.
  await page.evaluate(() => {
    const cur = window.Store.getState().ui.ml || {};
    window.Store.actions.setUI({ ml: { ...cur, task: 'logit', target: 'cls', feats: ['x', 'y2'] } });
  });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Train model|모델 학습/ }).click();
  await page.waitForTimeout(1500);
}

test('separable data → logit shows the not-converged warning', async ({ page }) => {
  await bootApp(page, { mode: 'data' });
  await registerAndTrainLogit(page, true);

  // Sanity: a logit result actually rendered (ROC title), and it reports not-converged in the store.
  await expect(page.locator('.ml-charttitle').first()).toContainText(/ROC/);
  const converged = await page.evaluate(() => (window.Store.getState().ui.ml.result || {}).converged);
  expect(converged).toBe(false);
  // The warning banner must be visible.
  await expect(page.getByText(WARN)).toBeVisible();
});

test('overlapping data → logit converges, no warning', async ({ page }) => {
  await bootApp(page, { mode: 'data' });
  await registerAndTrainLogit(page, false);

  await expect(page.locator('.ml-charttitle').first()).toContainText(/ROC/);
  const converged = await page.evaluate(() => (window.Store.getState().ui.ml.result || {}).converged);
  expect(converged).toBe(true);
  await expect(page.getByText(WARN)).toHaveCount(0);

  // tidy the shared project state
  await page.evaluate(async () => {
    window.Store.actions.setUI({ ml: { ...(window.Store.getState().ui.ml || {}), result: null } });
    window.Store.actions.setMode('data');
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
