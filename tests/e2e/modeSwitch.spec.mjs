// Mode-switch smoke E2E — regression net for the P0 crash (FOLLOWUP §0-1):
// modes were rendered as function calls in app.jsx, so a mode's top-level useStore(lang)
// shifted App's hook count on switch → "Rendered more hooks" crash → blank screen, and the
// persisted `mode` re-crashed on reload (bricking). Fixed by rendering modes as JSX elements.
// This test switches through every mode and asserts no crash, plus a reload-restore check.
import { test, expect } from '@playwright/test';

const MODES = ["data", "clean", "sql", "visualize", "pivot", "map", "dashboard", "ml", "stats"];

// A "crash" = blank app root, ErrorBoundary shown, or a React hook/render error in console.
async function switchAndCheck(page, to) {
  const hookErrors = [];
  const onMsg = (m) => { if (m.type() === "error" && /Rendered (more|fewer) hooks|hooks than during|Minified React error #(300|310|301)/i.test(m.text())) hookErrors.push(m.text()); };
  const onPageErr = (e) => { if (/hooks|Minified React error/i.test(e.message)) hookErrors.push(e.message); };
  page.on("console", onMsg);
  page.on("pageerror", onPageErr);
  await page.evaluate((m) => window.Store.actions.setMode(m), to);
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const app = document.querySelector(".app");
    return {
      mode: window.Store.getState().mode,
      blank: !app || app.childElementCount === 0,
      boundary: (document.body.innerText || "").includes("오류가 발생했습니다"),
    };
  });
  page.off("console", onMsg);
  page.off("pageerror", onPageErr);
  expect(s.mode, `Store.mode should be ${to}`).toBe(to);
  expect(s.blank, `${to}: app root must not be blank (crash)`).toBe(false);
  expect(s.boundary, `${to}: ErrorBoundary must not be shown (crash)`).toBe(false);
  expect(hookErrors, `${to}: no React hook/render error`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => window.Store && window.Store.actions && document.querySelector(".app"), { timeout: 30000 });
  await page.waitForTimeout(1000);
});

test("data → every mode switches without crashing", async ({ page }) => {
  for (const to of MODES) {
    await page.evaluate(() => window.Store.actions.setMode("data"));
    await page.waitForTimeout(150);
    await switchAndCheck(page, to);
  }
});

test("chaining through all modes back-to-back does not crash", async ({ page }) => {
  for (const to of MODES) {
    await switchAndCheck(page, to);
  }
});

test("a persisted non-data mode restores on reload without crashing (un-bricking)", async ({ page }) => {
  // set stats (a crashing mode before the fix), persist, reload — must come back to stats, no crash
  await page.evaluate(async () => {
    window.Store.actions.setMode("stats");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.Store && document.querySelector(".app"), { timeout: 30000 });
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => {
    const app = document.querySelector(".app");
    return { mode: window.Store.getState().mode, blank: !app || app.childElementCount === 0, boundary: (document.body.innerText || "").includes("오류가 발생했습니다") };
  });
  expect(s.blank, "reload: app must not be blank").toBe(false);
  expect(s.boundary, "reload: ErrorBoundary must not be shown").toBe(false);
  // restore to data at the end so we don't leave the shared server's saved state on a heavy mode
  await page.evaluate(async () => { window.Store.actions.setMode("data"); if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow(); });
});
