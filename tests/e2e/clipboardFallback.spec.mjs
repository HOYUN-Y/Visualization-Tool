// Clipboard fallback on non-secure origins (PLAN §12 A4).
//
// The async Clipboard API is secure-context-only: present on https:// and localhost, ABSENT on a plain
// http:// deployment. The app is deployed over http:// first (Cloudflare/AWS + HTTPS later), so "copy"
// would fail silently there and read as a broken button. `Charts.clipboardSupport()` names the reason at
// runtime so callers can explain it and fall back to a PNG download — and so the same build starts
// working automatically once it moves to HTTPS, with no code change.
//
// Playwright serves on http://localhost, which IS a secure context — so we stub `isSecureContext` and
// `navigator.clipboard` to simulate the http:// deployment this spec exists to protect.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test("clipboardSupport(): reports ready on a secure context with the API present", async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    // localhost is a secure context; Chromium exposes clipboard + ClipboardItem here.
    const sup = window.Charts.clipboardSupport();
    return { ok: sup.ok, reason: sup.reason, secure: window.isSecureContext };
  });
  expect(r.secure).toBe(true);
  expect(r.ok).toBe(true);
  expect(r.reason).toBe("ready");
});

test("clipboardSupport(): http:// deployment is reported as 'insecure', not as an unsupported browser", async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    // Simulate a plain http:// origin: no clipboard API, non-secure context.
    const origClip = navigator.clipboard, origItem = window.ClipboardItem;
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    delete window.ClipboardItem;
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    const sup = window.Charts.clipboardSupport();
    // restore so later assertions/teardown aren't affected
    Object.defineProperty(navigator, "clipboard", { value: origClip, configurable: true });
    window.ClipboardItem = origItem;
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    return sup;
  });
  // The distinction matters: telling an http:// user "your browser doesn't support copy" is a lie that
  // sends them chasing the wrong fix.
  expect(r.ok).toBe(false);
  expect(r.reason).toBe("insecure");
});

test("clipboardSupport(): secure context without the API is reported as 'unsupported'", async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    const origClip = navigator.clipboard, origItem = window.ClipboardItem;
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    delete window.ClipboardItem;                       // isSecureContext stays true
    const sup = window.Charts.clipboardSupport();
    Object.defineProperty(navigator, "clipboard", { value: origClip, configurable: true });
    window.ClipboardItem = origItem;
    return sup;
  });
  expect(r.ok).toBe(false);
  expect(r.reason).toBe("unsupported");
});

test("copyPNG resolves false (no throw) when the clipboard API is absent", async ({ page }) => {
  await bootApp(page, { activeId: "seoul_txns", mode: "visualize" });
  await page.evaluate(() => {
    window.Store.actions.setViz({
      type: "bar",
      cols: [{ key: "district", label: "district", role: "dimension", type: "string" }],
      rows: [{ key: "price_manwon", label: "price_manwon", role: "measure", type: "number", agg: "sum", id: "price_manwon_sum" }],
      color: null, sortDesc: true, topN: 0,
    });
  });
  await page.waitForTimeout(800); // let ECharts mount

  const r = await page.evaluate(async () => {
    const origClip = navigator.clipboard, origItem = window.ClipboardItem;
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    delete window.ClipboardItem;
    let resolved, threw = false;
    try { resolved = await window.Charts.copyPNG(undefined, window.Charts.lastInst); }
    catch (e) { threw = true; }
    Object.defineProperty(navigator, "clipboard", { value: origClip, configurable: true });
    window.ClipboardItem = origItem;
    return { resolved, threw, hadChart: !!window.Charts.lastInst };
  });
  expect(r.hadChart).toBe(true);
  expect(r.threw).toBe(false);      // must not reject — the caller awaits this to pick its fallback
  expect(r.resolved).toBe(false);
});
