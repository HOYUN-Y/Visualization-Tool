// P10 — new ML tasks (Decision Tree, Naive Bayes) train → result render without crash.
// Uses the hydration-safe boot (setMode reverts if fired before IndexedDB hydration completes).
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

async function mlReady(page) {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => {
    const l = document.querySelector("#node-loader");
    return window.Store && window.Store.actions && document.querySelector(".app") &&
      (!l || l.classList.contains("hiding") || getComputedStyle(l).display === "none");
  }, { timeout: 30000 });
  await page.waitForTimeout(1200);
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.evaluate(() => window.Store.actions.setActive("seoul_txns"));
  await page.evaluate(() => window.Store.actions.setMode("ml"));
  await page.waitForFunction(() => window.Store.getState().mode === "ml", { timeout: 5000 });
  await page.waitForTimeout(400);
}

async function trainTaskAndAssert(page, taskText) {
  await page.getByRole("button", { name: taskText }).click();
  await page.waitForTimeout(300);
  // ensure a categorical target with 2–20 classes is selected (building_type = 3 classes)
  await page.locator(".mlpanel select").first().selectOption("building_type").catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Train model|모델 학습/ }).click();
  await page.waitForTimeout(1800);
  const s = await page.evaluate(() => ({
    blank: !document.querySelector(".app") || document.querySelector(".app").childElementCount === 0,
    boundary: (document.body.innerText || "").includes("오류가 발생했습니다"),
    hasResult: !!document.querySelector(".ml-charttitle, .ml-metrics"),
  }));
  expect(s.blank, `${taskText}: not blank`).toBe(false);
  expect(s.boundary, `${taskText}: no ErrorBoundary`).toBe(false);
  expect(s.hasResult, `${taskText}: result rendered`).toBe(true);
}

test("Decision Tree trains and renders without crashing", async ({ page }) => {
  await mlReady(page);
  await trainTaskAndAssert(page, "Decision Tree");
});

test("Naive Bayes trains and renders without crashing", async ({ page }) => {
  await mlReady(page);
  await trainTaskAndAssert(page, "Naive Bayes");
});

test("Cross-validation (5-fold) shows a mean±std card", async ({ page }) => {
  await mlReady(page);
  await page.getByRole("button", { name: "Decision Tree" }).click();
  await page.waitForTimeout(300);
  await page.locator(".mlpanel select").first().selectOption("building_type").catch(() => {});
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "5-fold" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Train model|모델 학습/ }).click();
  await page.waitForTimeout(2200);
  const txt = await page.evaluate(() => document.body.innerText || "");
  expect(txt).toMatch(/교차검증/);
  expect(txt).toMatch(/±/);
  await page.evaluate(async () => {
    window.Store.actions.setUI({ ml: { ...(window.Store.getState().ui.ml || {}), result: null } });
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
