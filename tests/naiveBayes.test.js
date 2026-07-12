"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const NB = require("../js/naiveBayes.js");

// ---------------------------------------------------------------------------
// Two well-separated Gaussian blobs:
//   class "A" clustered around (0, 0)
//   class "B" clustered around (10, 10)
// ---------------------------------------------------------------------------

function blobRows() {
  const rows = [];
  // deterministic jitter (no Math.random) so tests are reproducible
  const jitterA = [-0.6, -0.2, 0.1, 0.4, 0.7];
  const jitterB = [-0.5, -0.1, 0.2, 0.3, 0.8];
  for (let i = 0; i < jitterA.length; i++) {
    rows.push({ x: 0 + jitterA[i], y: 0 - jitterA[i], cls: "A" });
    rows.push({ x: 10 + jitterB[i], y: 10 - jitterB[i], cls: "B" });
  }
  return rows;
}

test("fit returns sorted classes, priors, stats", () => {
  const m = NB.fit(blobRows(), ["x", "y"], "cls");
  assert.deepEqual(m.classes, ["A", "B"]);
  assert.deepEqual(m.featKeys, ["x", "y"]);
  assert.ok(Math.abs(m.priors.A - 0.5) < 1e-12);
  assert.ok(Math.abs(m.priors.B - 0.5) < 1e-12);
  // class A mean near (0,0), class B mean near (10,10)
  assert.ok(Math.abs(m.stats.A.mean[0] - 0) < 1, `A meanX=${m.stats.A.mean[0]}`);
  assert.ok(Math.abs(m.stats.B.mean[0] - 10) < 1, `B meanX=${m.stats.B.mean[0]}`);
});

test("training points classify to their own class", () => {
  const rows = blobRows();
  const m = NB.fit(rows, ["x", "y"], "cls");
  for (const r of rows) {
    assert.equal(m.predict(r), r.cls, `row ${JSON.stringify(r)}`);
    // standalone predictOne agrees with the bound closure
    assert.equal(NB.predictOne(m, r), r.cls);
  }
});

test("a point near (0,0) → A, near (10,10) → B", () => {
  const m = NB.fit(blobRows(), ["x", "y"], "cls");
  assert.equal(m.predict({ x: 0.3, y: -0.1 }), "A");
  assert.equal(m.predict({ x: 9.7, y: 10.2 }), "B");
  assert.equal(NB.predictOne(m, { x: 1, y: 1 }), "A");
  assert.equal(NB.predictOne(m, { x: 9, y: 9 }), "B");
});

test("proba(row) sums to ~1 and is higher for the correct class", () => {
  const m = NB.fit(blobRows(), ["x", "y"], "cls");

  const pA = m.proba({ x: 0.2, y: 0.1 });
  const sumA = pA.A + pA.B;
  assert.ok(Math.abs(sumA - 1) < 1e-12, `sum=${sumA}`);
  assert.ok(pA.A > pA.B, `pA.A=${pA.A} pA.B=${pA.B}`);
  assert.ok(pA.A > 0.5);

  const pB = NB.probaOne(m, { x: 10.1, y: 9.9 });
  const sumB = pB.A + pB.B;
  assert.ok(Math.abs(sumB - 1) < 1e-12, `sum=${sumB}`);
  assert.ok(pB.B > pB.A, `pB.A=${pB.A} pB.B=${pB.B}`);
});

test("constant feature does not produce NaN (still classifies)", () => {
  // feature 'k' is constant (variance 0) across all rows → uninformative,
  // must not blow up the log-gaussian with a divide-by-zero.
  const rows = [];
  for (let i = 0; i < 4; i++) rows.push({ x: i * 0.1, k: 5, cls: "A" });
  for (let i = 0; i < 4; i++) rows.push({ x: 10 + i * 0.1, k: 5, cls: "B" });

  const m = NB.fit(rows, ["x", "k"], "cls");
  const p = m.proba({ x: 0.15, k: 5 });
  assert.ok(Number.isFinite(p.A) && Number.isFinite(p.B), `p=${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.A + p.B - 1) < 1e-12);
  assert.equal(m.predict({ x: 0.15, k: 5 }), "A");
  assert.equal(m.predict({ x: 10.15, k: 5 }), "B");
});

test("rows with missing/non-finite features or target are filtered", () => {
  const rows = blobRows().slice();
  rows.push({ x: null, y: 1, cls: "A" });      // missing feature
  rows.push({ x: "abc", y: 1, cls: "B" });     // non-numeric feature
  rows.push({ x: 1, y: 1, cls: "" });          // missing target
  rows.push({ x: 1, y: undefined, cls: "A" }); // missing feature
  const m = NB.fit(rows, ["x", "y"], "cls");
  // only the 10 clean blob rows survive
  assert.equal(m.n, 10);
  assert.equal(m.stats.A.count, 5);
  assert.equal(m.stats.B.count, 5);
});

test("throws with < 2 classes", () => {
  const rows = [
    { x: 1, y: 2, cls: "only" },
    { x: 3, y: 4, cls: "only" }
  ];
  assert.throws(() => NB.fit(rows, ["x", "y"], "cls"), /< 2 classes/);
});

test("throws with no features", () => {
  const rows = blobRows();
  assert.throws(() => NB.fit(rows, [], "cls"), /at least 1 feature/);
});

test("throws with too few complete rows", () => {
  const rows = [{ x: 1, y: 2, cls: "A" }]; // only 1 row
  assert.throws(() => NB.fit(rows, ["x", "y"], "cls"), /at least 2 complete rows/);
});

test("numeric target labels are handled and sorted numerically", () => {
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push({ x: i * 0.1, t: 0 });
  for (let i = 0; i < 3; i++) rows.push({ x: 10 + i * 0.1, t: 1 });
  const m = NB.fit(rows, ["x"], "t");
  assert.deepEqual(m.classes, ["0", "1"]);
  assert.equal(m.predict({ x: 0.05 }), "0");
  assert.equal(m.predict({ x: 10.05 }), "1");
});
