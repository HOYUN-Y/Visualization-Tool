// Stats — time-series decomposition UI: the additive/multiplicative toggle. The engine
// (window.TSDecomp) is unit-tested in tests/timeSeriesDecomp.test.js; this covers the UI path the
// unit tests can't — clicking Decomposition → multiplicative renders the "Model" card + 4 panels
// without crashing (FOLLOWUP §1 observation: multiplicative was never clicked in verification).
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test("Stats decomposition: multiplicative model renders without crashing", async ({ page }) => {
  await bootApp(page, { activeId: "monthly_index", mode: "stats" });
  // select the Time Series test (state-driven — robust to label/i18n), then drive the toggles by click
  await page.evaluate(() => window.Store.actions.setUI({ stats: { ...(window.Store.getState().ui.stats || {}), test: "timeseries" } }));
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Decomposition" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^multiplicative$/i }).click();
  await page.waitForTimeout(500);

  const s = await page.evaluate(() => {
    const app = document.querySelector(".app");
    const active = [...document.querySelectorAll(".seg .on")].map((b) => b.textContent);
    return {
      blank: !app || app.childElementCount === 0,
      boundary: (document.body.innerText || "").includes("오류가 발생했습니다"),
      model: window.Store.getState().ui.stats.tsModel,
      multiplicativeActive: active.includes("multiplicative"),
      bodyHasModel: (document.body.innerText || "").toLowerCase().includes("multiplicative"),
    };
  });
  expect(s.blank, "app not blank").toBe(false);
  expect(s.boundary, "no ErrorBoundary").toBe(false);
  expect(s.model, "tsModel = multiplicative").toBe("multiplicative");
  expect(s.multiplicativeActive, "multiplicative button highlighted").toBe(true);
  expect(s.bodyHasModel, "Model card reflects multiplicative").toBe(true);

  // tidy the shared server's saved state
  await page.evaluate(async () => {
    window.Store.actions.setUI({ stats: { ...(window.Store.getState().ui.stats || {}), test: "distribution" } });
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
