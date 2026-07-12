const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");

// Load the REAL store.jsx (no JSX; needs only window.NODE + React stubs) — same harness as storeMemo.test.js.
function loadStore() {
  const sandbox = {
    window: {
      NODE: {
        datasets: [{
          id: "seoul_txns", name: "T",
          rows: [{ a: 1, b: 10, name: "x" }, { a: 2, b: 20, name: "y" }, { a: 3, b: 30, name: "z" }],
          columns: [
            { key: "a", label: "a", type: "integer", role: "measure" },
            { key: "b", label: "b", type: "integer", role: "measure" },
            { key: "name", label: "name", type: "string", role: "dimension" },
          ],
        }],
        round: (v, d) => Number(Number(v).toFixed(d)),
        lastAnalysisResult: null, mlHistory: [],
      },
    },
    React: { useReducer: () => [0, () => {}], useEffect: () => {} },
  };
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "store.jsx"), "utf8");
  new Function("window", "React", code)(sandbox.window, sandbox.React);
  return sandbox.window.Store;
}

const rids = (S) => S.derive.getActiveData("seoul_txns").rows.map((r) => r.__rid);

test("editCells applies multiple cell edits across rows/columns in one shot", () => {
  const S = loadStore();
  const [r0, r1] = rids(S);
  S.actions.editCells([
    { rid: r0, col: "a", value: 100 },
    { rid: r0, col: "name", value: "AA" },
    { rid: r1, col: "b", value: 999 },
  ]);
  const rows = S.derive.getActiveData("seoul_txns").rows;
  assert.equal(rows.find((r) => r.__rid === r0).a, 100);
  assert.equal(rows.find((r) => r.__rid === r0).name, "AA");
  assert.equal(rows.find((r) => r.__rid === r1).b, 999);
  assert.equal(rows.find((r) => r.__rid === r1).a, 2); // untouched
});

test("a batch edit is a SINGLE undoable step (one undo reverts all cells)", () => {
  const S = loadStore();
  const [r0, r1] = rids(S);
  S.actions.editCells([
    { rid: r0, col: "a", value: 100 },
    { rid: r1, col: "b", value: 999 },
  ]);
  S.actions.undo(); // one undo
  const rows = S.derive.getActiveData("seoul_txns").rows;
  assert.equal(rows.find((r) => r.__rid === r0).a, 1);   // reverted
  assert.equal(rows.find((r) => r.__rid === r1).b, 20);  // reverted
  S.actions.redo();
  const rows2 = S.derive.getActiveData("seoul_txns").rows;
  assert.equal(rows2.find((r) => r.__rid === r0).a, 100); // redone together
  assert.equal(rows2.find((r) => r.__rid === r1).b, 999);
});

test("numeric coercion: invalid strings become null in numeric columns, never pollute", () => {
  const S = loadStore();
  const [r0] = rids(S);
  S.actions.editCells([
    { rid: r0, col: "a", value: "not a number" },
    { rid: r0, col: "b", value: "42" },       // numeric string → 42
    { rid: r0, col: "name", value: 7 },        // string column keeps as-is
  ]);
  const row = S.derive.getActiveData("seoul_txns").rows.find((r) => r.__rid === r0);
  assert.equal(row.a, null);   // invalid numeric → null
  assert.equal(row.b, 42);     // coerced
  assert.equal(row.name, 7);   // string col untouched by coercion
});

test("unknown column or rid is skipped without crashing", () => {
  const S = loadStore();
  const [r0] = rids(S);
  assert.doesNotThrow(() => S.actions.editCells([
    { rid: r0, col: "ghost", value: 1 },   // no such column
    { rid: 99999, col: "a", value: 5 },    // no such rid
    { rid: r0, col: "a", value: 8 },       // valid — should still apply
  ]));
  assert.equal(S.derive.getActiveData("seoul_txns").rows.find((r) => r.__rid === r0).a, 8);
});

test("empty cells list is a no-op that does not corrupt data", () => {
  const S = loadStore();
  S.actions.editCells([]);
  assert.deepEqual(S.derive.getActiveData("seoul_txns").rows.map((r) => r.a), [1, 2, 3]);
});
