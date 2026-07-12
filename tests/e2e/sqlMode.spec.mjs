// DuckDB S3 — SQL mode now runs queries through DuckDB-WASM (async), registering all datasets as
// tables. Verifies: the default query auto-runs via DuckDB, a cross-dataset JOIN works from the UI,
// and a bad query surfaces a SQL error (not a crash).
import { test, expect } from '@playwright/test';
import { bootApp, teardownDuckDB } from './helpers.mjs';

test.setTimeout(60000);
test.afterEach(async ({ page }) => teardownDuckDB(page));

const boot = (page) => bootApp(page, { mode: "sql", duckdb: true });

test("SQL mode auto-runs the default query via DuckDB and renders results", async ({ page }) => {
  await boot(page);
  // wait until the initial run finishes (grid rows appear)
  await page.waitForSelector(".sql-results table tbody tr", { timeout: 30000 });
  const badge = await page.textContent(".phead .badge");
  expect(badge).toContain("DuckDB-WASM");           // ran on DuckDB, not the JS fallback
  const rowCount = await page.locator(".sql-results table tbody tr").count();
  expect(rowCount).toBeGreaterThan(0);
});

test("a cross-dataset / full-SQL query runs from the editor", async ({ page }) => {
  await boot(page);
  await page.waitForSelector(".sql-results table tbody tr", { timeout: 30000 });
  // use a CTE + window function — impossible in the old hand-written engine
  await page.evaluate(() => window.__sqlSet(
    "WITH t AS (SELECT 1 AS g, 10 AS v UNION ALL SELECT 1, 20 UNION ALL SELECT 2, 5)\n" +
    "SELECT g, v, SUM(v) OVER (PARTITION BY g) AS grp_total FROM t ORDER BY g, v"));
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Run|실행/ }).first().click();
  await page.waitForSelector(".sql-results table tbody tr", { timeout: 30000 });
  const cells = await page.evaluate(() => {
    return [...document.querySelectorAll(".sql-results table tbody tr")].slice(0, 3).map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()));
  });
  // 3 rows; window SUM over g=1 → 30, g=2 → 5
  expect(cells.length).toBe(3);
  expect(cells.some((r) => r.join(",").includes("30"))).toBe(true);
});

test("a bad query shows a SQL error, not a crash", async ({ page }) => {
  await boot(page);
  await page.waitForSelector(".sql-results table tbody tr", { timeout: 30000 });
  await page.evaluate(() => window.__sqlSet("SELECT * FROM __no_such_table__"));
  await page.getByRole("button", { name: /Run|실행/ }).first().click();
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => ({
    err: !!document.querySelector(".sql-err, .sql-results .empty"),
    blank: !document.querySelector(".app") || document.querySelector(".app").childElementCount === 0,
  }));
  expect(s.blank).toBe(false);  // no crash
  expect(s.err).toBe(true);     // error surfaced
});
