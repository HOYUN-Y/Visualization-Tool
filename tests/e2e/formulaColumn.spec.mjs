// Formula Column safety (FOLLOWUP §5 A1). The Clean-mode Formula Column used `new Function("row",
// "Math", expr)` — arbitrary code execution the moment a project JSON / share link is opened from an
// untrusted source. It's now compiled by the safe recursive-descent evaluator (window.FormulaEval:
// row.* reads + whitelisted Math.* only, no eval/new Function). This spec proves, in a real browser,
// that (a) a legit formula still derives the right column, and (b) a code-exec payload is neutralized
// (no global side effect; derived value is null) instead of running.
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

test("Formula Column: legit expr derives values; code-exec payload is neutralized (A1)", async ({ page }) => {
  await bootApp(page, { activeId: "seoul_txns", mode: "data" });

  const r = await page.evaluate(() => {
    const A = window.Store.actions;
    const out = {};

    // sanity: the safe evaluator is loaded (not new Function)
    out.hasFormulaEval = !!(window.FormulaEval && window.FormulaEval.compile);

    // (a) legit formula: derive area_x2 = row.area_m2 * 2 on the active dataset
    A.addStep({ op: "formula", params: { name: "area_x2", expr: "row.area_m2 * 2" } });
    let d = window.Store.derive.getActiveData(window.Store.getState().activeId);
    const col = d.columns.find((c) => c.key === "area_x2");
    const sample = d.rows.find((row) => row.area_m2 != null);
    out.legitColMade = !!col;
    out.legitCorrect = sample ? Math.abs(sample.area_x2 - sample.area_m2 * 2) < 1e-6 : false;

    // (b) code-exec payload: try to set a global via constructor escape. Must NOT run.
    window.__PWNED__ = false;
    A.addStep({ op: "formula", params: { name: "evil", expr: "row.constructor.constructor('window.__PWNED__=true')()" } });
    d = window.Store.derive.getActiveData(window.Store.getState().activeId);
    const evilCol = d.columns.find((c) => c.key === "evil");
    const evilSample = d.rows[0];
    out.pwned = window.__PWNED__;                       // must stay false — code never executed
    out.evilValueNull = evilCol ? (evilSample.evil == null) : true;  // derived value neutralized

    // (c) another payload: reference a global directly — also inert
    window.__PWNED2__ = false;
    A.addStep({ op: "formula", params: { name: "evil2", expr: "window.__PWNED2__ = true" } });
    out.pwned2 = window.__PWNED2__;                     // must stay false

    return out;
  });

  expect(r.hasFormulaEval, "safe FormulaEval evaluator is loaded").toBe(true);
  expect(r.legitColMade, "legit formula creates the derived column").toBe(true);
  expect(r.legitCorrect, "legit formula computes the right value").toBe(true);
  expect(r.pwned, "constructor-escape payload did NOT execute").toBe(false);
  expect(r.evilValueNull, "malicious formula yields a null/absent value").toBe(true);
  expect(r.pwned2, "direct-global-assignment payload did NOT execute").toBe(false);

  // tidy shared server state (drop the test steps, back to a clean data view)
  await page.evaluate(async () => {
    const s = window.Store.getState();
    if (window.Store.actions.clearSteps) window.Store.actions.clearSteps();
    delete window.__PWNED__; delete window.__PWNED2__;
    window.Store.actions.setMode("data");
    if (window.ProjectStore && window.ProjectStore.saveNow) await window.ProjectStore.saveNow();
  });
});
