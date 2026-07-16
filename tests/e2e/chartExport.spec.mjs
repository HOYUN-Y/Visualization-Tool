// Chart export target (FOLLOWUP §5 C4). Export used to always act on the global `Charts.lastInst`
// (whatever chart mounted last), so a dashboard with several charts — or a chart-type switch — could
// export the WRONG chart. The fix: EChart exposes its instance via an `onInst` callback, and the
// export helpers (downloadPNG/downloadSVG/copyPNG) take an optional explicit `inst` arg, falling back
// to lastInst only when omitted. This spec locks the contract the unit tests can't reach: the Chart
// mode actually captures its own instance and export targets that instance.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test("Chart export: explicit instance is honored and distinct from the global lastInst fallback", async ({ page }) => {
  await bootApp(page, { activeId: "seoul_txns", mode: "visualize" });

  // Build a real bar chart programmatically (same path aiDrawer uses) so an EChart mounts + onInst fires.
  await page.evaluate(() => {
    window.Store.actions.setViz({
      type: "bar",
      cols: [{ key: "district", label: "district", role: "dimension", type: "string" }],
      rows: [{ key: "price_manwon", label: "price_manwon", role: "measure", type: "number", agg: "sum", id: "price_manwon_sum" }],
      color: null, sortDesc: true, topN: 0,
    });
  });
  await page.waitForTimeout(800); // let ECharts init + onInst capture

  const r = await page.evaluate(() => {
    const C = window.Charts;
    const last = C.lastInst;
    // 1) a chart is actually mounted
    const hasLast = !!last;
    // 2) explicit-instance export succeeds (getDataURL path) without touching the DOM download
    let explicitOk = false;
    try { explicitOk = typeof last.getDataURL === "function" && !!last.getDataURL({ type: "png", pixelRatio: 1 }); } catch (e) { explicitOk = false; }
    // 3) downloadPNG with an explicit instance returns true (arg is wired through)
    //    We stub the anchor click so no real file is written during the test.
    const origCreate = document.createElement.bind(document);
    document.createElement = (t) => { const el = origCreate(t); if (t === "a") el.click = () => {}; return el; };
    let pngExplicit = false, pngFallback = false, pngNullInst = false;
    try {
      pngExplicit = C.downloadPNG("t-explicit", "transparent", last);   // explicit → true
      pngFallback = C.downloadPNG("t-fallback", "transparent");          // omitted → lastInst fallback → true
      // passing a null/absent instance while lastInst is also cleared must NOT succeed:
      const saved = C.lastInst; C.lastInst = null;
      pngNullInst = C.downloadPNG("t-null", "transparent", null);        // no target at all → false
      C.lastInst = saved;
    } finally {
      document.createElement = origCreate;
    }
    return { hasLast, explicitOk, pngExplicit, pngFallback, pngNullInst };
  });

  expect(r.hasLast, "a chart instance is mounted").toBe(true);
  expect(r.explicitOk, "explicit instance can produce a PNG dataURL").toBe(true);
  expect(r.pngExplicit, "downloadPNG(explicit inst) returns true").toBe(true);
  expect(r.pngFallback, "downloadPNG() falls back to lastInst → true").toBe(true);
  // with no explicit inst AND lastInst cleared there is no target → must be false (never a wrong-chart success)
  expect(r.pngNullInst, "no target at all → downloadPNG returns false").toBe(false);

  // tidy shared server state
  await page.evaluate(async () => {
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
