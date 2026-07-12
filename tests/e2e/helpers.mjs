// Shared E2E boot/teardown helpers. The one subtle thing every spec must get right is NOT touching
// Store (setMode/setActive) before IndexedDB hydration finishes — hydration overwrites the whole
// persisted state, so a setMode fired too early gets silently reverted. The reliable signal that
// hydration is done is the loading screen (#node-loader) gaining `.hiding` / going display:none.
// (Model: the previously hand-rolled waits in mlEligibility/mlNewTasks — now unified here.)

// Wait until the app is booted AND hydrated, then optionally pick a dataset + mode.
//   bootApp(page, { mode, activeId, duckdb })
//   - duckdb:true  → also wait for window.DuckDB.status === "ready" (SQL/DuckDB specs)
//   - activeId     → setActive(id) and wait for it to stick
//   - mode         → setMode(mode) and wait for Store.mode === mode
export async function bootApp(page, opts = {}) {
  const { mode, activeId, duckdb, dialogDismiss = true } = opts;
  await page.goto("/index.html", { waitUntil: "load" });
  // hydration-complete gate: loader hidden + Store/actions/.app present
  await page.waitForFunction(() => {
    const l = document.querySelector("#node-loader");
    return window.Store && window.Store.actions && document.querySelector(".app") &&
      (!l || l.classList.contains("hiding") || getComputedStyle(l).display === "none");
  }, { timeout: 30000 });
  await page.waitForTimeout(600); // small settle after loader hides
  if (dialogDismiss) page.on("dialog", (d) => d.dismiss().catch(() => {}));
  if (duckdb) await page.waitForFunction(() => window.DuckDB && window.DuckDB.status === "ready", { timeout: 40000 });
  if (activeId) {
    await page.evaluate((i) => window.Store.actions.setActive(i), activeId);
    await page.waitForFunction((i) => window.Store.getState().activeId === i, activeId, { timeout: 5000 });
    await page.waitForTimeout(300);
  }
  if (mode) {
    await page.evaluate((m) => window.Store.actions.setMode(m), mode);
    await page.waitForFunction((m) => window.Store.getState().mode === m, mode, { timeout: 5000 });
    await page.waitForTimeout(300);
  }
}

// Terminate the DuckDB Web Worker so Chrome can exit cleanly (otherwise Playwright force-kills the
// worker process after 5 min at the end of the run). Every index.html load instantiates DuckDB, and
// specs that don't wait for `ready` may still be mid-instantiation here — so terminate() alone can
// no-op (state.db still null) and leave a worker that finishes loading after the test. Navigating to
// about:blank unloads the document, which kills its dedicated Web Worker regardless of state. Safe to
// call when DuckDB never loaded.
export async function teardownDuckDB(page) {
  try {
    await page.evaluate(() => window.DuckDB && window.DuckDB.terminate && window.DuckDB.terminate());
  } catch (e) { /* page may already be closing */ }
  try {
    // Navigating away unloads the document → kills its dedicated DuckDB Web Worker.
    await page.goto("about:blank", { waitUntil: "load" });
  } catch (e) { /* page may already be closing */ }
}
