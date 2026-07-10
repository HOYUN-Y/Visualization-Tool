const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const DataOps = require(path.join(__dirname, "..", "js", "dataOps.js"));

function ds(id, columns, rows) {
  return { id, short: id, name: id + ".csv", columns, rows };
}
const col = (key, type, extra) => Object.assign({ key, label: key, type, role: (type === "integer" || type === "float") ? "measure" : "dimension", agg: (type === "integer" || type === "float") ? "sum" : null }, extra || {});

test("union promotes conflicting types along boolean→integer→float→string", () => {
  assert.equal(DataOps.promoteType(["integer", "float"]), "float");
  assert.equal(DataOps.promoteType(["boolean", "integer"]), "integer");
  assert.equal(DataOps.promoteType(["integer", "string"]), "string");
  assert.equal(DataOps.promoteType(["datetime", "datetime"]), "datetime");
  assert.equal(DataOps.promoteType(["category", "string"]), "string");
});

test("union unions column keys, fills missing with null, keeps first-dataset order", () => {
  const a = ds("a", [col("id", "integer"), col("amount", "integer")], [{ id: 1, amount: 10 }]);
  const b = ds("b", [col("id", "integer"), col("amount", "float"), col("note", "string")], [{ id: 2, amount: 2.5, note: "x" }]);
  const r = DataOps.union([a, b]);
  assert.deepEqual(r.columns.map((c) => c.key), ["id", "amount", "note"]);
  assert.equal(r.columns.find((c) => c.key === "amount").type, "float"); // promoted
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].note, null);        // missing key filled
  assert.equal(r.rows[1].note, "x");
  assert.deepEqual(r.lineage.sourceIds, ["a", "b"]);
});

test("union addSource appends a __source category column", () => {
  const a = ds("sales_a", [col("v", "integer")], [{ v: 1 }]);
  const b = ds("sales_b", [col("v", "integer")], [{ v: 2 }, { v: 3 }]);
  const r = DataOps.union([a, b], { addSource: true });
  assert.ok(r.columns.some((c) => c.key === "__source"));
  assert.equal(r.rows[0].__source, "sales_a");
  assert.equal(r.rows[2].__source, "sales_b");
  assert.deepEqual(r.sourceCounts, { sales_a: 1, sales_b: 2 });
});

test("union rejects fewer than two datasets", () => {
  assert.throws(() => DataOps.union([ds("a", [col("v", "integer")], [])]), /at least two/);
});

test("inner join matches on key, drops right key column, renames collisions", () => {
  const left = ds("orders", [col("cust", "integer"), col("amount", "integer")], [{ cust: 1, amount: 100 }, { cust: 2, amount: 50 }]);
  const right = ds("cust", [col("cust", "integer"), col("amount", "integer"), col("name", "string")], [{ cust: 1, amount: 999, name: "Kim" }]);
  const r = DataOps.join(left, right, { type: "inner", keyPairs: [{ left: "cust", right: "cust" }] });
  // right join key 'cust' dropped; right 'amount' collides -> renamed
  assert.deepEqual(r.columns.map((c) => c.key), ["cust", "amount", "cust__amount", "name"]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].amount, 100);
  assert.equal(r.rows[0].cust__amount, 999);
  assert.equal(r.rows[0].name, "Kim");
  assert.equal(r.stats.leftUnmatched, 1);
});

test("left / right / full joins keep unmatched rows with nulls", () => {
  const left = ds("l", [col("k", "integer"), col("lv", "integer")], [{ k: 1, lv: 10 }, { k: 2, lv: 20 }]);
  const right = ds("r", [col("k", "integer"), col("rv", "integer")], [{ k: 2, rv: 200 }, { k: 3, rv: 300 }]);
  const kp = [{ left: "k", right: "k" }];

  const inner = DataOps.join(left, right, { type: "inner", keyPairs: kp });
  assert.equal(inner.rows.length, 1);

  const lj = DataOps.join(left, right, { type: "left", keyPairs: kp });
  assert.equal(lj.rows.length, 2);
  assert.equal(lj.rows.find((x) => x.k === 1).rv, null);

  const rj = DataOps.join(left, right, { type: "right", keyPairs: kp });
  assert.equal(rj.rows.length, 2);
  const r3 = rj.rows.find((x) => x.rv === 300);
  assert.equal(r3.k, 3);   // right key mapped onto left key column
  assert.equal(r3.lv, null);

  const fj = DataOps.join(left, right, { type: "full", keyPairs: kp });
  assert.equal(fj.rows.length, 3); // k=1 (left only), k=2 (match), k=3 (right only)
});

test("join treats null keys as non-matching and normalizes number vs numeric-string", () => {
  const left = ds("l", [col("k", "string"), col("lv", "integer")], [{ k: "1", lv: 1 }, { k: null, lv: 9 }]);
  const right = ds("r", [col("k", "integer"), col("rv", "integer")], [{ k: 1, rv: 100 }]);
  const r = DataOps.join(left, right, { type: "inner", keyPairs: [{ left: "k", right: "k" }] });
  assert.equal(r.rows.length, 1);         // "1" matches 1, null does not
  assert.equal(r.rows[0].rv, 100);
});

test("join flags many-to-many explosion and reports output row count", () => {
  const left = ds("l", [col("k", "integer"), col("a", "integer")], [{ k: 1, a: 1 }, { k: 1, a: 2 }]);
  const right = ds("r", [col("k", "integer"), col("b", "integer")], [{ k: 1, b: 10 }, { k: 1, b: 20 }]);
  const r = DataOps.join(left, right, { type: "inner", keyPairs: [{ left: "k", right: "k" }] });
  assert.equal(r.rows.length, 4);         // 2x2 cross
  assert.equal(r.stats.outputRows, 4);
  assert.equal(r.stats.manyToMany, true);
});

test("toDataset builds a registerable dataset and preview caps rows", () => {
  const a = ds("a", [col("v", "integer")], Array.from({ length: 150 }, (_, i) => ({ v: i })));
  const b = ds("b", [col("v", "integer")], [{ v: -1 }]);
  const r = DataOps.union([a, b]);
  const out = DataOps.toDataset(r, { short: "merged" });
  assert.equal(out.id, "combine_merged");
  assert.equal(out.source, "Union");
  assert.equal(out.rows.length, 151);
  assert.ok(out.lineage);
  assert.equal(DataOps.preview(r).length, 100);
  assert.equal(DataOps.preview(r, 5).length, 5);
});
