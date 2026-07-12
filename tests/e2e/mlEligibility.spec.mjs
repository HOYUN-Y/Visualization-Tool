// P13 — ML data-eligibility gating: ineligible tasks are disabled (not click-then-alert), targets
// are filtered + class-annotated, and Logistic works on a multi-class target via positive-class
// (one-vs-rest). Verifies the "data decides what you can run" behavior headlessly.
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

async function mlReady(page) {
  await page.goto("/index.html", { waitUntil: "load" });
  // wait for the loading screen to hide — this signals IndexedDB hydration finished. Setting mode
  // before hydration completes gets reverted (hydration overwrites the whole persisted state).
  await page.waitForFunction(() => {
    const l = document.querySelector("#node-loader");
    return window.Store && window.Store.actions && document.querySelector(".app") &&
      (!l || l.classList.contains("hiding") || getComputedStyle(l).display === "none");
  }, { timeout: 30000 });
  await page.waitForTimeout(1200);
  page.on("dialog", (d) => d.dismiss().catch(() => {})); // there must be NO alert now, but guard anyway
  await page.evaluate(() => window.Store.actions.setMode("ml"));
  await page.waitForFunction(() => window.Store.getState().mode === "ml", { timeout: 5000 });
  await page.waitForTimeout(400);
}

// switching the active dataset also needs a settle so the panel re-renders eligibility
async function setActive(page, id) {
  await page.evaluate((i) => window.Store.actions.setActive(i), id);
  await page.waitForFunction((i) => window.Store.getState().activeId === i, id, { timeout: 5000 });
  await page.waitForTimeout(400);
}

const taskDisabled = (page, text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll(".ml-taskbtn")].find((x) => x.textContent.includes(t));
  return b ? (b.disabled || b.className.includes("disabled")) : null;
}, text);

test("a dataset with no 2–20 class categorical disables the classification tasks", async ({ page }) => {
  await mlReady(page);
  // monthly_index has only `month` (42 distinct) → no valid clf/logit target
  await setActive(page, "monthly_index");
  expect(await taskDisabled(page, "k-NN Classify")).toBe(true);
  expect(await taskDisabled(page, "Logistic")).toBe(true);
  // regression still fine (numeric columns present)
  expect(await taskDisabled(page, "Regression")).toBe(false);
});

test("classification target selector shows class-count annotations", async ({ page }) => {
  await mlReady(page);
  await setActive(page, "seoul_txns");
  await page.getByRole("button", { name: "k-NN Classify" }).click();
  await page.waitForTimeout(300);
  const opts = await page.$$eval(".mlpanel select option", (os) => os.map((o) => o.textContent));
  // e.g. "building_type (3 클래스)" — some option carries a class count annotation
  expect(opts.some((t) => /\(\d+ 클래스\)/.test(t))).toBe(true);
});

test("Logistic on a 3-class target trains via positive-class (one-vs-rest) without crashing", async ({ page }) => {
  await mlReady(page);
  await setActive(page, "seoul_txns");
  await page.getByRole("button", { name: "Logistic + ROC" }).click();
  await page.waitForTimeout(300);
  await page.locator(".mlpanel select").first().selectOption("building_type"); // 3 classes → one-vs-rest
  await page.waitForTimeout(400);
  // a positive-class select should now be present (2 selects in the panel)
  const selectCount = await page.locator(".mlpanel select").count();
  expect(selectCount).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: /Train model|모델 학습/ }).click();
  await page.waitForTimeout(1800);
  const s = await page.evaluate(() => ({
    blank: !document.querySelector(".app") || document.querySelector(".app").childElementCount === 0,
    boundary: (document.body.innerText || "").includes("오류가 발생했습니다"),
    hasResult: !!document.querySelector(".ml-charttitle, .ml-metrics"),
  }));
  expect(s.blank).toBe(false);
  expect(s.boundary).toBe(false);
  expect(s.hasResult).toBe(true);
  // cleanup
  await page.evaluate(async () => {
    window.Store.actions.setUI({ ml: { ...(window.Store.getState().ui.ml || {}), result: null } });
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
