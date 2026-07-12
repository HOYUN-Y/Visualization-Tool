// ML train→render smoke E2E — regression net for FOLLOWUP §0-0b: the ML result title map in
// mlMode.jsx evaluated res.feats[0] eagerly for ALL branches, so Regression / k-NN (which have no
// `feats`) crashed on result render (and the persisted ui.ml.result locked the mode across reloads).
// The "8-mode switch" smoke did NOT catch this — you must actually train. Fixed via optional chaining
// + ErrorBoundary clearing ui.ml.result.
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

async function ready(page) {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => window.Store && window.Store.actions && document.querySelector(".app"), { timeout: 30000 });
  await page.waitForTimeout(800);
  page.on("dialog", (d) => d.dismiss().catch(() => {})); // don't let any alert() hang the run
}

async function assertNoCrash(page, label) {
  const s = await page.evaluate(() => {
    const app = document.querySelector(".app");
    return {
      blank: !app || app.childElementCount === 0,
      boundary: (document.body.innerText || "").includes("오류가 발생했습니다"),
      hasResult: !!document.querySelector(".ml-charttitle, .ml-metrics"),
    };
  });
  expect(s.blank, `${label}: app not blank`).toBe(false);
  expect(s.boundary, `${label}: no ErrorBoundary`).toBe(false);
  expect(s.hasResult, `${label}: ML result rendered`).toBe(true);
}

test("ML Regression: train → result renders without crash", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.Store.actions.setMode("ml"));
  await page.waitForTimeout(400);
  // default task is regression; click Train (label is language-dependent → match both)
  await page.getByRole("button", { name: /Train model|모델 학습/ }).click();
  await page.waitForTimeout(1500);
  await assertNoCrash(page, "reg");
});

test("ML k-NN Classify: train → result renders without crash", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.Store.actions.setMode("ml"));
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /k-NN Classify/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Train model|모델 학습/ }).click();
  await page.waitForTimeout(1500);
  await assertNoCrash(page, "clf");
  // leave a clean state (clear any trained result) so the shared server's autosave stays tidy
  await page.evaluate(async () => {
    window.Store.actions.setUI({ ml: { ...(window.Store.getState().ui.ml || {}), result: null } });
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
