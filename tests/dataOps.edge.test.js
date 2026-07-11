const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const D = require(path.join(__dirname, "..", "js", "dataOps.js"));

const ds = (id, columns, rows) => ({ id, name: id, columns, rows });
const col = (key, type, role, agg) => ({ key, label: key, type, role: role || "dimension", agg });

test("promoteType follows the boolean→integer→float→string ladder", () => {
  assert.equal(D.promoteType(["boolean", "integer"]), "integer");
  assert.equal(D.promoteType(["integer", "float"]), "float");
  assert.equal(D.promoteType(["integer", "string"]), "string");
  assert.equal(D.promoteType(["datetime", "integer"]), "string");
  assert.equal(D.promoteType([]), "string");
});

test("union requires at least two datasets", () => {
  assert.throws(() => D.union([], {}));
  assert.throws(() => D.union([ds("a", [col("x", "integer", "measure")], [{ x: 1 }])], {}));
});

test("union takes the key-union and fills missing columns with null", () => {
  const a = ds("a", [col("x", "integer", "measure")], [{ x: 1 }]);
  const b = ds("b", [col("y", "integer", "measure")], [{ y: 2 }]);
  const r = D.union([a, b], {});
  const keys = r.columns.map((c) => c.key);
  assert.ok(keys.includes("x") && keys.includes("y"));
  const rowX = r.rows.find((row) => row.x === 1);
  assert.equal(rowX.y, null); // missing filled with null
});

test("union with addSource adds a __source column and per-source counts", () => {
  const a = ds("a", [col("x", "integer", "measure")], [{ x: 1 }, { x: 2 }]);
  const b = ds("b", [col("x", "integer", "measure")], [{ x: 3 }]);
  const r = D.union([a, b], { addSource: true });
  assert.ok(r.columns.some((c) => c.key === "__source"));
  assert.equal(r.rows.length, 3);
});

test("union tolerates a zero-row dataset", () => {
  const a = ds("a", [col("x", "integer", "measure")], []);
  const b = ds("b", [col("x", "integer", "measure")], [{ x: 9 }]);
  const r = D.union([a, b], {});
  assert.equal(r.rows.length, 1);
});

test("join: null keys never match (null !== null)", () => {
  const left = ds("l", [col("k", "string"), col("lv", "integer", "measure")], [{ k: null, lv: 1 }, { k: "a", lv: 2 }]);
  const right = ds("r", [col("k", "string"), col("rv", "integer", "measure")], [{ k: null, rv: 9 }, { k: "a", rv: 8 }]);
  const inner = D.join(left, right, { type: "inner", keyPairs: [{ left: "k", right: "k" }] });
  assert.equal(inner.rows.length, 1); // only the "a" pair; nulls excluded
  assert.equal(inner.rows[0].lv, 2);
});

test("join normalizes numeric vs string keys (1 matches \"1\")", () => {
  const left = ds("l", [col("k", "integer"), col("lv", "integer", "measure")], [{ k: 1, lv: 5 }]);
  const right = ds("r", [col("k", "string"), col("rv", "integer", "measure")], [{ k: "1", rv: 7 }]);
  const r = D.join(left, right, { type: "inner", keyPairs: [{ left: "k", right: "k" }] });
  assert.equal(r.rows.length, 1);
});

test("join flags many-to-many explosion in stats", () => {
  const left = ds("l", [col("k", "string"), col("lv", "integer", "measure")], [{ k: "a", lv: 1 }, { k: "a", lv: 2 }]);
  const right = ds("r", [col("k", "string"), col("rv", "integer", "measure")], [{ k: "a", rv: 1 }, { k: "a", rv: 2 }]);
  const r = D.join(left, right, { type: "inner", keyPairs: [{ left: "k", right: "k" }] });
  assert.equal(r.rows.length, 4); // 2×2
  assert.equal(r.stats.manyToMany, true);
});

test("join renames a duplicate right column instead of clobbering", () => {
  const left = ds("l", [col("k", "string"), col("v", "integer", "measure")], [{ k: "a", v: 1 }]);
  const right = ds("r", [col("k", "string"), col("v", "integer", "measure")], [{ k: "a", v: 9 }]);
  const r = D.join(left, right, { type: "inner", keyPairs: [{ left: "k", right: "k" }] });
  const keys = r.columns.map((c) => c.key);
  assert.ok(keys.includes("v"));
  assert.ok(keys.some((k) => k !== "v" && /v/.test(k))); // right v renamed
});

test("join rejects a missing/empty keyPairs and an unknown join type", () => {
  const left = ds("l", [col("k", "string")], [{ k: "a" }]);
  const right = ds("r", [col("k", "string")], [{ k: "a" }]);
  assert.throws(() => D.join(left, right, { type: "inner", keyPairs: [] }));
  assert.throws(() => D.join(left, right, { type: "bogus", keyPairs: [{ left: "k", right: "k" }] }));
});
