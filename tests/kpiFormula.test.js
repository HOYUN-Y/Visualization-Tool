const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const KPI = require(path.join(__dirname, "..", "js", "kpiFormula.js"));

const ROWS = [
  { revenue: 100, profit: 30, region: "A" },
  { revenue: 200, profit: 40, region: "B" },
  { revenue: 300, profit: null, region: "A" },
];
const COLS = [
  { key: "revenue", type: "integer" },
  { key: "profit", type: "integer" },
  { key: "region", type: "category" },
];

test("evaluates aggregate ratio with precedence", () => {
  const r = KPI.compute("SUM(profit) / SUM(revenue) * 100", ROWS, COLS);
  assert.equal(r.error, null);
  assert.equal(Math.round(r.value * 100) / 100, 11.67); // 70 / 600 * 100
});

test("COUNT(*) counts rows, COUNT/COUNTD respect nulls and distinct", () => {
  assert.equal(KPI.compute("COUNT(*)", ROWS, COLS).value, 3);
  assert.equal(KPI.compute("COUNT(profit)", ROWS, COLS).value, 2);       // one null
  assert.equal(KPI.compute("COUNTD(region)", ROWS, COLS).value, 2);      // A, B
});

test("supports + - * / parentheses, unary minus, numeric literals", () => {
  assert.equal(KPI.compute("(SUM(revenue) - SUM(profit)) / 2", ROWS, COLS).value, 265); // (600-70)/2
  assert.equal(KPI.compute("-MIN(revenue)", ROWS, COLS).value, -100);
  assert.equal(KPI.compute("MAX(revenue) + 1", ROWS, COLS).value, 301);
  assert.equal(KPI.compute("MEDIAN(revenue)", ROWS, COLS).value, 200);
});

test("division by zero yields an error and null value", () => {
  const r = KPI.compute("SUM(revenue) / COUNTD(missingConst)", ROWS, COLS);
  assert.ok(r.error); // unknown field first
  const z = KPI.compute("1 / (SUM(profit) - 70)", ROWS, COLS); // 70-70 = 0
  assert.match(z.error, /Division by zero/);
  assert.equal(z.value, null);
});

test("unknown field and unknown function are rejected", () => {
  assert.match(KPI.compute("SUM(nope)", ROWS, COLS).error, /Unknown field/);
  assert.match(KPI.compute("FOO(revenue)", ROWS, COLS).error, /Unknown function/);
});

test("rejects arbitrary code — no identifiers outside agg calls", () => {
  assert.ok(KPI.compute("revenue + 1", ROWS, COLS).error);           // bare field not allowed
  assert.ok(KPI.compute("process.exit(1)", ROWS, COLS).error);
  assert.ok(KPI.compute("SUM(revenue))", ROWS, COLS).error);          // trailing token
  assert.ok(KPI.compute("* is only valid in COUNT", ROWS, COLS).error);
});

test("* is only valid inside COUNT", () => {
  assert.ok(KPI.compute("SUM(*)", ROWS, COLS).error);
  assert.equal(KPI.compute("COUNT(*)", ROWS, COLS).error, null);
});
