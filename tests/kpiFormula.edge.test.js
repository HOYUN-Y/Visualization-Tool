const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const K = require(path.join(__dirname, "..", "js", "kpiFormula.js"));

const cols = [{ key: "x", type: "float" }, { key: "y", type: "float" }, { key: "z", type: "string" }];
const rows = [{ x: 10, y: 0, z: "a" }, { x: 20, y: 0, z: "b" }, { x: 30, y: 0, z: "a" }];

const val = (expr, r = rows) => K.compute(expr, r, cols);

test("division by zero returns a null value with an error, never throws", () => {
  const r = val("SUM(x)/0");
  assert.equal(r.value, null);
  assert.ok(r.error);
  assert.equal(val("SUM(x)/SUM(y)").value, null); // SUM(y) === 0
});

test("unknown column surfaces an error, not a crash", () => {
  const r = val("SUM(nope)");
  assert.equal(r.value, null);
  assert.ok(/nope/.test(r.error));
});

test("syntax errors are reported (unbalanced parens, empty, lone operator)", () => {
  assert.ok(val("SUM(x").error);
  assert.ok(val("").error);
  assert.ok(val("+").error);
});

test("nested parens, COUNT(*), COUNTD evaluate correctly", () => {
  assert.equal(val("((SUM(x)+SUM(x)))").value, 120);
  assert.equal(val("COUNT(*)").value, 3);
  assert.equal(val("COUNTD(z)").value, 2); // a, b
});

test("negative and decimal literals with unary minus", () => {
  assert.equal(val("SUM(x) * -0.5").value, -30);
  assert.equal(val("-MIN(x)").value, -10);
});

test("aggregates over empty rows return null and propagate through arithmetic", () => {
  assert.equal(val("MEDIAN(x)", []).value, null);
  assert.equal(val("MIN(x) + 1", []).value, null);
});

test("AVG over all-zeros is 0 (distinguished from no-data null)", () => {
  assert.equal(val("AVG(y)").value, 0);
});
