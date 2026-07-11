const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const Pivot = require(path.join(__dirname, "..", "js", "pivotEngine.js"));

const DATA = [
  { region: "A", q: "Q1", amount: 10 },
  { region: "A", q: "Q1", amount: 20 },
  { region: "A", q: "Q2", amount: 30 },
  { region: "B", q: "Q1", amount: 100 },
];
const COLS = [
  { key: "region", type: "category", role: "dimension" },
  { key: "q", type: "category", role: "dimension" },
  { key: "amount", type: "integer", role: "measure" },
];
// locate a leaf's cell value for a given row tuple + column tuple + value id
function cell(res, rowVal, colVal, valId) {
  const row = res.rows.find((r) => String(r.key[0]) === String(rowVal));
  const leaf = res.leaves.find((l) => (colVal == null || String(l.colTuple[0]) === String(colVal)) && l.value.id === valId);
  return row.cells[leaf.id];
}

test("aggregate helper matches store semantics incl empty groups", () => {
  assert.equal(Pivot.aggregate([1, 2, 3], "sum"), 6);
  assert.equal(Pivot.aggregate([1, 2, 3], "avg"), 2);
  assert.equal(Pivot.aggregate([1, 2, 3, 3], "countd"), 3);
  assert.equal(Pivot.aggregate([], "sum"), 0);
  assert.equal(Pivot.aggregate([], "avg"), null);
  assert.equal(Pivot.aggregate([1, 2, 3, 4], "median"), 2.5);
});

test("rows-only pivot sums each group with a recomputed grand total", () => {
  const res = Pivot.build(DATA, COLS, { rows: ["region"], columns: [], values: [{ key: "amount", agg: "sum" }] });
  assert.equal(cell(res, "A", null, "amount__sum"), 60);
  assert.equal(cell(res, "B", null, "amount__sum"), 100);
  assert.equal(res.grandTotal["amount__sum"], 160);
});

test("rows × columns cross-tab fills empty cells with 0 for sum", () => {
  const res = Pivot.build(DATA, COLS, { rows: ["region"], columns: ["q"], values: [{ key: "amount", agg: "sum" }] });
  assert.equal(res.leaves.length, 2); // Q1, Q2
  assert.equal(cell(res, "A", "Q1", "amount__sum"), 30);
  assert.equal(cell(res, "A", "Q2", "amount__sum"), 30);
  assert.equal(cell(res, "B", "Q1", "amount__sum"), 100);
  assert.equal(cell(res, "B", "Q2", "amount__sum"), 0); // B has no Q2 rows
  // row totals recomputed from source, not sum of cells
  assert.equal(res.rows.find((r) => r.key[0] === "A").total["amount__sum"], 60);
  // column totals
  assert.equal(res.colTotals[res.leaves.find((l) => l.colTuple[0] === "Q1").id], 130);
  assert.equal(res.colTotals[res.leaves.find((l) => l.colTuple[0] === "Q2").id], 30);
});

test("avg grand total recomputes from rows, not average of cell averages", () => {
  const res = Pivot.build(DATA, COLS, { rows: ["region"], columns: ["q"], values: [{ key: "amount", agg: "avg" }] });
  assert.equal(cell(res, "A", "Q1", "amount__avg"), 15);
  assert.equal(cell(res, "A", "Q2", "amount__avg"), 30);
  // A row total avg = (10+20+30)/3 = 20, NOT (15+30)/2 = 22.5
  assert.equal(res.rows.find((r) => r.key[0] === "A").total["amount__avg"], 20);
});

test("multiple values each keep independent aggregation", () => {
  const res = Pivot.build(DATA, COLS, { rows: ["region"], columns: [], values: [{ key: "amount", agg: "sum" }, { key: "amount", agg: "count" }] });
  assert.equal(res.leaves.length, 2);
  assert.equal(cell(res, "A", null, "amount__sum"), 60);
  assert.equal(cell(res, "A", null, "amount__count"), 3);
});

test("category and range filters restrict the source before aggregation", () => {
  const inRes = Pivot.build(DATA, COLS, { rows: ["region"], columns: [], values: [{ key: "amount", agg: "sum" }], filters: [{ key: "region", kind: "in", values: ["A"] }] });
  assert.equal(inRes.rows.length, 1);
  assert.equal(inRes.grandTotal["amount__sum"], 60);

  const rangeRes = Pivot.build(DATA, COLS, { rows: ["region"], columns: [], values: [{ key: "amount", agg: "sum" }], filters: [{ key: "amount", kind: "range", min: 25, max: null }] });
  assert.equal(rangeRes.grandTotal["amount__sum"], 130); // 30 + 100
});

test("toDataset flattens to registerable columns and optional grand-total row", () => {
  const res = Pivot.build(DATA, COLS, { rows: ["region"], columns: ["q"], values: [{ key: "amount", agg: "sum" }] });
  const ds = Pivot.toDataset(res, { short: "sales_pivot", grandTotalRow: true });
  assert.equal(ds.id, "pivot_sales_pivot");
  assert.equal(ds.source, "Pivot");
  assert.equal(ds.columns[0].key, "region");
  assert.equal(ds.columns.length, 3); // region + Q1 + Q2
  assert.equal(ds.rows.length, 3);    // A, B, Grand Total
  assert.equal(ds.rows[2].region, "Grand Total");
  assert.ok(ds.lineage && ds.lineage.op === "pivot");
});

test("empty value list is rejected", () => {
  assert.throws(() => Pivot.build(DATA, COLS, { rows: ["region"], values: [] }), /at least one value/);
});
