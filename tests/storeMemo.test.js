const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");

// store.jsx is browser-only (assigns window.Store) but contains no JSX and only needs
// window.NODE.{datasets,round} + React.{useReducer,useEffect}. We stub those and eval the
// REAL source so this exercises the live getActiveData memoization + invalidation.
function loadStore() {
  const sandbox = {
    window: {
      NODE: {
        datasets: [{
          id: "seoul_txns", name: "T",
          rows: [{ a: 1, b: 10 }, { a: 2, b: 20 }, { a: 3, b: 30 }],
          columns: [
            { key: "a", label: "a", type: "integer", role: "measure" },
            { key: "b", label: "b", type: "integer", role: "measure" },
          ],
        }],
        round: (v, d) => Number(Number(v).toFixed(d)),
        lastAnalysisResult: null, mlHistory: [],
      },
    },
    React: { useReducer: () => [0, () => {}], useEffect: () => {} },
  };
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "store.jsx"), "utf8");
  // run the IIFE with our stubs as free variables (window/React)
  new Function("window", "React", code)(sandbox.window, sandbox.React);
  return sandbox.window.Store;
}

test("getActiveData returns the same reference when nothing changed (cache hit)", () => {
  const S = loadStore();
  const r1 = S.derive.getActiveData("seoul_txns");
  const r2 = S.derive.getActiveData("seoul_txns");
  assert.equal(r1, r2);
  assert.equal(r1.rows.length, 3);
  assert.equal(r1.rows[0].a, 1);
});

test("an edit invalidates the cache and is reflected; repeat call re-hits", () => {
  const S = loadStore();
  const r1 = S.derive.getActiveData("seoul_txns");
  const rid = r1.rows[0].__rid;
  S.actions.editCell(rid, "b", 999);
  const r3 = S.derive.getActiveData("seoul_txns");
  assert.notEqual(r3, r1); // new reference
  assert.equal(r3.rows.find((x) => x.__rid === rid).b, 999);
  assert.equal(S.derive.getActiveData("seoul_txns"), r3); // re-hit after settle
});

test("undo/redo change the cursor and invalidate the memo", () => {
  const S = loadStore();
  const r1 = S.derive.getActiveData("seoul_txns");
  const rid = r1.rows[0].__rid;
  S.actions.editCell(rid, "b", 999);
  const edited = S.derive.getActiveData("seoul_txns");
  S.actions.undo();
  const undone = S.derive.getActiveData("seoul_txns");
  assert.notEqual(undone, edited);
  assert.equal(undone.rows.find((x) => x.__rid === rid).b, 10); // reverted
  S.actions.redo();
  assert.equal(S.derive.getActiveData("seoul_txns").rows.find((x) => x.__rid === rid).b, 999);
});

test("editing derives a new view without mutating the source dataset", () => {
  const S = loadStore();
  const r1 = S.derive.getActiveData("seoul_txns");
  S.actions.editCell(r1.rows[0].__rid, "b", 999);
  S.derive.getActiveData("seoul_txns");
  // the raw registered dataset must stay untouched (edits live in the cleaning pipeline)
  assert.equal(S.derive.getDataset("seoul_txns").rows[0].b, 10);
});
