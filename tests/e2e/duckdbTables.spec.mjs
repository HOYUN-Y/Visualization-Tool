// DuckDB S2 — registerDatasets(): every dataset's cleaned view becomes a queryable table, and
// multiple datasets coexist in one DuckDB instance (cross-dataset SQL — the headline of the swap).
import { test, expect } from '@playwright/test';

test.setTimeout(60000);

async function bootReady(page) {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => window.Store && document.querySelector(".app"), { timeout: 30000 });
  await page.waitForFunction(() => window.DuckDB && window.DuckDB.status === "ready", { timeout: 40000 });
}

test("registerDatasets exposes each dataset as a table with matching row counts", async ({ page }) => {
  await bootReady(page);
  const tables = await page.evaluate(async () => await window.DuckDB.registerDatasets());
  expect(Array.isArray(tables)).toBe(true);
  expect(tables.length).toBeGreaterThanOrEqual(1);

  // COUNT(*) of each table must equal the reported row count (cleaned view registered correctly)
  const check = await page.evaluate(async (tbls) => {
    const out = [];
    for (const t of tbls) {
      const r = await window.DuckDB.query(`SELECT COUNT(*) AS n FROM "${t.table.replace(/"/g, '""')}"`);
      out.push({ table: t.table, expected: t.rows, got: r.rows[0].n });
    }
    return out;
  }, tables);
  for (const c of check) expect(c.got, `${c.table} row count`).toBe(c.expected);
});

test("two datasets coexist in one instance → cross-dataset query works", async ({ page }) => {
  await bootReady(page);
  const tables = await page.evaluate(async () => await window.DuckDB.registerDatasets());
  test.skip(tables.length < 2, "need at least 2 datasets for a cross-dataset query");
  const res = await page.evaluate(async (tbls) => {
    const a = tbls[0].table.replace(/"/g, '""'), b = tbls[1].table.replace(/"/g, '""');
    // scalar subqueries over two different registered tables in one statement
    return await window.DuckDB.query(`SELECT (SELECT COUNT(*) FROM "${a}") AS a_n, (SELECT COUNT(*) FROM "${b}") AS b_n`);
  }, tables);
  expect(res.rows[0].a_n).toBe(tables[0].rows);
  expect(res.rows[0].b_n).toBe(tables[1].rows);
});

test("__rid internal column is excluded from registered tables", async ({ page }) => {
  await bootReady(page);
  const tables = await page.evaluate(async () => await window.DuckDB.registerDatasets());
  const cols = await page.evaluate(async (t) => {
    const r = await window.DuckDB.query(`SELECT * FROM "${t.replace(/"/g, '""')}" LIMIT 1`);
    return r.columns.map((c) => c.key);
  }, tables[0].table);
  expect(cols).not.toContain("__rid");
});
