const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const O = require(path.join(__dirname, "..", "js", "outliers.js"));

// A tight cluster around (0,0) with correlation, plus one obvious far point.
function cluster(n) {
  const rows = [];
  // deterministic pseudo-spread (no RNG): small lattice around origin
  for (let i = 0; i < n; i++) {
    const t = (i % 7) - 3;
    rows.push({ x: t * 0.1, y: t * 0.1 + (i % 3 - 1) * 0.05 });
  }
  return rows;
}

test("detect flags an obvious multivariate outlier", () => {
  const rows = cluster(30).concat([{ x: 50, y: -50 }]); // last row is far off
  const r = O.detect(rows, ["x", "y"]);
  assert.equal(r.ok, true);
  assert.ok(r.outliers.includes(30), "the far point (index 30) is flagged");
  // its squared distance is the largest
  const far = r.results.find((p) => p.index === 30);
  const maxD2 = Math.max(...r.results.map((p) => p.d2));
  assert.equal(far.d2, maxD2);
});

test("a clean cluster with no extreme point flags few/none at alpha 0.975", () => {
  const rows = cluster(40);
  const r = O.detect(rows, ["x", "y"], { alpha: 0.975 });
  assert.equal(r.ok, true);
  assert.ok(r.outliers.length <= 3); // ~2.5% expected under the cutoff
});

test("topK returns exactly the K most extreme points regardless of threshold", () => {
  const rows = cluster(30).concat([{ x: 50, y: -50 }, { x: 30, y: 30 }]);
  const r = O.detect(rows, ["x", "y"], { topK: 2 });
  assert.equal(r.outliers.length, 2);
  assert.ok(r.outliers.includes(30) && r.outliers.includes(31));
});

test("degrade: singular covariance (constant column) is reported, not crashed", () => {
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push({ x: i, y: 5 }); // y constant → singular cov
  const r = O.detect(rows, ["x", "y"]);
  assert.equal(r.ok, false);
  assert.match(r.reason, /singular/);
});

test("degrade: fewer complete rows than dimensions is reported", () => {
  const rows = [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }];
  const r = O.detect(rows, ["x", "y", "z"]);
  assert.equal(r.ok, false);
  assert.equal(r.outliers.length, 0);
});

test("needs at least 2 numeric columns", () => {
  assert.throws(() => O.detect([{ x: 1 }], ["x"]), /at least 2/);
});

test("rows with missing values in the selected keys are skipped, indices preserved", () => {
  const rows = cluster(20);
  rows[5].x = null; // drop this row from the fit
  const r = O.detect(rows.concat([{ x: 40, y: 40 }]), ["x", "y"]);
  assert.ok(r.results.every((p) => p.index !== 5)); // skipped
  assert.ok(r.outliers.includes(20)); // far point still detected
});

test("chiSquareQuantile is monotonic in probability and reasonable for df=2", () => {
  const q95 = O.chiSquareQuantile(0.95, 2);
  const q99 = O.chiSquareQuantile(0.99, 2);
  assert.ok(q99 > q95);
  assert.ok(Math.abs(q95 - 5.991) < 0.2); // known χ²(2, .95) ≈ 5.99
});
