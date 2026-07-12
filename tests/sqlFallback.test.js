// sqlFallback.js — hand-written JS SQL engine (DuckDB fallback). Focus: Unicode (Korean) column and
// table identifiers, which the previous ASCII-only [\w]+ regexes could not parse.
const test = require("node:test");
const assert = require("node:assert");
const SQL = require("../js/sqlFallback.js");

// minimal aggregate fns + round + dataset injection (mirrors NODE.* / derive in the app)
const aggFn = {
  sum: (a) => a.reduce((s, v) => s + (Number(v) || 0), 0),
  avg: (a) => a.length ? aggFn.sum(a) / a.length : 0,
  count: (a) => a.length,
  min: (a) => Math.min(...a.map(Number)),
  max: (a) => Math.max(...a.map(Number)),
  median: (a) => { const s = a.map(Number).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; },
};
const round = (v, d) => Number(Number(v).toFixed(d));

// dataset with KOREAN column + table names — the whole point of the Unicode fix
const rows = [
  { 구역: "강남", 값: 10, type: "아파트" },
  { 구역: "강남", 값: 20, type: "아파트" },
  { 구역: "서초", 값: 5, type: "오피스텔" },
];
const ctx = {
  datasets: [{ id: "지역", short: "지역", columns: [{ key: "구역" }, { key: "값" }, { key: "type" }] }],
  getRows: () => rows.map((r) => ({ ...r })),
  aggFn,
  round,
};
const run = (sql) => SQL.runSQL(sql, ctx);

test("Korean table + GROUP BY + aggregate alias + ORDER BY DESC", () => {
  const res = run("SELECT 구역, SUM(값) AS 합계 FROM 지역 GROUP BY 구역 ORDER BY 합계 DESC");
  assert.equal(res.error, undefined, res.error);
  assert.deepEqual(res.rows, [{ 구역: "강남", 합계: 30 }, { 구역: "서초", 합계: 5 }]);
});

test("Korean column in WHERE (equality)", () => {
  const res = run("SELECT * FROM 지역 WHERE 구역 = '강남'");
  assert.equal(res.error, undefined, res.error);
  assert.equal(res.rows.length, 2);
  assert.ok(res.rows.every((r) => r.구역 === "강남"));
});

test("Korean column in WHERE with LIKE", () => {
  const res = run("SELECT * FROM 지역 WHERE 구역 like '강%'");
  assert.equal(res.error, undefined, res.error);
  assert.equal(res.rows.length, 2);
});

test("projection alias on Korean columns + ORDER BY ASC", () => {
  const res = run("SELECT 구역 AS 지역명, 값 FROM 지역 ORDER BY 값 ASC");
  assert.equal(res.error, undefined, res.error);
  assert.deepEqual(res.rows.map((r) => r.값), [5, 10, 20]);
  assert.ok("지역명" in res.rows[0]);
});

test("COUNT(*) and multi-agg over Korean group", () => {
  const res = run("SELECT type, COUNT(*) AS n, AVG(값) AS m FROM 지역 GROUP BY type ORDER BY n DESC");
  assert.equal(res.error, undefined, res.error);
  const apt = res.rows.find((r) => r.type === "아파트");
  assert.equal(apt.n, 2);
  assert.equal(apt.m, 15);
});

test("unknown table surfaces an error (not a throw)", () => {
  const res = run("SELECT * FROM 없는테이블");
  assert.match(res.error, /Unknown table/);
});

test("AGG_RE matches a Korean aggregate argument (regression for [\\w]+)", () => {
  assert.ok(SQL.AGG_RE.test("SUM(값)"));
  assert.ok(SQL.AGG_RE.test("count(*)"));
});
