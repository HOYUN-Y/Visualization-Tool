// DuckDB-WASM S1 loading smoke E2E — verifies the app's ES-module island (js/duckdbEngine.mjs)
// loads DuckDB from the CDN, instantiates (Worker + wasm), and answers a query through the
// integrated window.DuckDB API with the app's { columns, rows } shape + type mapping.
// This is the "make-or-break" gate for the DuckDB transition, run headlessly.
import { test, expect } from '@playwright/test';

test.setTimeout(90000); // CDN + wasm download can take several seconds

test("window.DuckDB loads from CDN and answers a query", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  // module is deferred → wait for the global, then for instantiation
  await page.waitForFunction(() => window.DuckDB && window.DuckDB.ready, { timeout: 30000 });
  const status = await page.evaluate(async () => {
    try { await window.DuckDB.ready; return window.DuckDB.status; }
    catch (e) { return "failed:" + (e && e.message); }
  });
  expect(status).toBe("ready");

  const res = await page.evaluate(async () => {
    return await window.DuckDB.query("SELECT 42 AS answer, 'hi' AS s, 3.5 AS f, TRUE AS b");
  });
  // shape + type mapping (Arrow → app)
  expect(res.rows).toEqual([{ answer: 42, s: "hi", f: 3.5, b: true }]);
  const byKey = Object.fromEntries(res.columns.map((c) => [c.key, c.type]));
  expect(byKey.answer).toBe("integer");
  expect(byKey.s).toBe("string");
  expect(byKey.f).toBe("float");
  expect(byKey.b).toBe("boolean");
});

test("DuckDB handles a real SQL feature the hand-written engine lacks (JOIN + CTE)", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => window.DuckDB && window.DuckDB.status === "ready", { timeout: 40000 });
  const res = await page.evaluate(async () => {
    return await window.DuckDB.query(`
      WITH a(id, v) AS (VALUES (1,'x'),(2,'y')),
           b(id, n) AS (VALUES (1,10),(2,20))
      SELECT a.v, b.n FROM a JOIN b USING(id) ORDER BY a.v`);
  });
  expect(res.rows).toEqual([{ v: "x", n: 10 }, { v: "y", n: 20 }]);
});
