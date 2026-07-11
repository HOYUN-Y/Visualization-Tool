const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const P = require(path.join(__dirname, "..", "js", "pivotEngine.js"));

const cols = [
  { key: "region", label: "region", type: "string", role: "dimension" },
  { key: "team", label: "team", type: "string", role: "dimension" },
  { key: "amt", label: "amt", type: "float", role: "measure", agg: "sum" },
];

// Regression for the null/blank dimension bug: cells + subtotals for a null group used to read 0
// (bucket keyed null→"" but readback used String(null)="null"), leaving subtotals ≠ grand total.
test("null dimension value keeps its cells and subtotal (reconciles with grand total)", () => {
  const rows = [{ region: null, amt: 5 }, { region: "N", amt: 10 }, { region: null, amt: 3 }];
  const r = P.build(rows, cols, { rows: ["region"], values: [{ key: "amt", agg: "sum" }] });
  const nullRow = r.rows.find((x) => x.key[0] == null);
  const leaf = r.leaves[0].id;
  assert.equal(nullRow.total.amt__sum, 8);
  assert.equal(nullRow.cells[leaf], 8);
  assert.equal(r.grandTotal.amt__sum, 18);
  const subSum = r.rows.reduce((s, x) => s + x.total.amt__sum, 0);
  assert.equal(subSum, r.grandTotal.amt__sum); // subtotals reconcile
});

test("null value on the COLUMN axis keeps its column totals", () => {
  const rows = [{ region: "A", team: null, amt: 4 }, { region: "A", team: "X", amt: 6 }];
  const r = P.build(rows, cols, { rows: ["region"], columns: ["team"], values: [{ key: "amt", agg: "sum" }] });
  const nullLeaf = r.leaves.find((l) => l.colTuple[0] == null);
  assert.ok(nullLeaf, "a leaf exists for the null team");
  assert.equal(r.colTotals[nullLeaf.id], 4);
});

test("build throws when no value field is supplied", () => {
  assert.throws(() => P.build([{ region: "A" }], cols, { rows: ["region"], values: [] }), /at least one value/);
});

test("empty source rows → empty matrix, zero grand total, rowCount 0", () => {
  const r = P.build([], cols, { rows: ["region"], values: [{ key: "amt", agg: "sum" }] });
  assert.equal(r.rowCount, 0);
  assert.equal(r.grandTotal.amt__sum, 0);
});

test("a filter that excludes everything yields an empty pivot", () => {
  const rows = [{ region: "A", amt: 1 }, { region: "B", amt: 2 }];
  const r = P.build(rows, cols, {
    rows: ["region"], values: [{ key: "amt", agg: "sum" }],
    filters: [{ key: "region", kind: "in", values: ["ZZZ"] }],
  });
  assert.equal(r.rowCount, 0);
  assert.equal(r.grandTotal.amt__sum, 0);
});

test("grand total for avg is recomputed from source rows, not averaged from subtotals", () => {
  // region A: [10, 30] (avg 20, n2); region B: [90] (avg 90, n1). True overall avg = 130/3 ≈ 43.33,
  // NOT the mean of subtotals (20+90)/2 = 55.
  const rows = [{ region: "A", amt: 10 }, { region: "A", amt: 30 }, { region: "B", amt: 90 }];
  const r = P.build(rows, cols, { rows: ["region"], values: [{ key: "amt", agg: "avg" }] });
  assert.ok(Math.abs(r.grandTotal.amt__avg - 130 / 3) < 1e-9);
});

test("multiple column dimensions produce flattened leaf headers", () => {
  const rows = [
    { region: "A", team: "X", amt: 1 }, { region: "A", team: "Y", amt: 2 },
    { region: "B", team: "X", amt: 3 },
  ];
  const r = P.build(rows, cols, { rows: ["region"], columns: ["team"], values: [{ key: "amt", agg: "sum" }] });
  const teams = r.leaves.map((l) => l.colTuple[0]).sort();
  assert.deepEqual(teams, ["X", "Y"]);
});
