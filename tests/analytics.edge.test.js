const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const J = (m) => require(path.join(__dirname, "..", "js", m));
const PCA = J("pca.js"), LR = J("logistic.js"), TS = J("timeSeries.js"), DF = J("distributionFit.js"), CA = J("chartAdvisor.js");

const finite = (v) => v == null || Number.isFinite(v);
const allFinite = (arr) => arr.every((v) => finite(v));

// ---------- PCA ----------
test("pca: constant column and all-identical rows never produce NaN", () => {
  const constCol = PCA.fit([{ a: 1, b: 5 }, { a: 2, b: 5 }, { a: 3, b: 5 }], ["a", "b"]);
  assert.ok(allFinite(constCol.eigenvalues));
  assert.ok(allFinite(constCol.explainedRatio));

  const same = PCA.fit([{ a: 1, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 1 }], ["a", "b"]);
  assert.ok(allFinite(same.eigenvalues));
  assert.ok(same.explainedRatio.every((v) => v === 0 || Number.isFinite(v)));
});

test("pca: fat matrix (n < p) stays finite; too-few rows/keys throw", () => {
  const fat = PCA.fit([{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }], ["a", "b", "c"]);
  assert.ok(allFinite(fat.eigenvalues));
  assert.throws(() => PCA.fit([{ a: 1, b: 2 }], ["a", "b"])); // single row
  assert.throws(() => PCA.fit([{ a: 1 }, { a: 2 }], ["a"]));   // single key
});

// ---------- Logistic ----------
test("logistic: perfectly separable data converges to finite weights", () => {
  const rows = [{ x: -2, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }];
  const m = LR.fit(rows, ["x"], "y");
  assert.ok(m.weights.every(Number.isFinite));
});

test("logistic: roc/prCurve on degenerate inputs return finite numbers, no NaN", () => {
  assert.ok(Number.isFinite(LR.roc([], []).auc));
  assert.ok(Number.isFinite(LR.roc([1, 1, 1], [0.2, 0.5, 0.9]).auc)); // all-positive labels
  assert.ok(Number.isFinite(LR.prCurve([0, 0, 0], [0.2, 0.5, 0.9]).ap)); // all-negative labels
});

// ---------- Time Series ----------
test("timeSeries: movingAverage with window > length is all null", () => {
  const r = TS.movingAverage([1, 2, 3], 5);
  assert.ok(r.every((v) => v === null));
});

test("timeSeries: acf/pacf on a constant (zero-variance) series is 0, not NaN", () => {
  const a = TS.acf([5, 5, 5, 5, 5], 2);
  assert.ok(allFinite(a));
  const p = TS.pacf([5, 5, 5, 5, 5], 2);
  assert.ok(allFinite(p));
});

test("timeSeries: exponentialSmoothing rejects alpha outside [0,1]", () => {
  assert.throws(() => TS.exponentialSmoothing([1, 2, 3], 2));
  assert.throws(() => TS.exponentialSmoothing([1, 2, 3], -0.1));
  assert.deepEqual(TS.exponentialSmoothing([], 0.5), []);
});

// ---------- Distribution Fit ----------
test("distFit: jarqueBera reports null (not a false 'normal') for n < 4", () => {
  assert.equal(DF.jarqueBera([]).pValue, null);
  assert.equal(DF.jarqueBera([1, 2, 3]).pValue, null);
  assert.equal(typeof DF.jarqueBera([1, 2, 3, 4, 5, 6]).pValue, "number");
});

test("distFit: qqNormal/histogram survive constant, single, empty inputs", () => {
  assert.doesNotThrow(() => DF.qqNormal([5, 5, 5]));
  assert.doesNotThrow(() => DF.qqNormal([]));
  const h = DF.histogram([1, 2, 3], 0); // bins=0 → falls back to a sane default
  assert.ok(Array.isArray(h.bins) && h.bins.length > 0);
});

// ---------- Chart Advisor ----------
test("chartAdvisor.recommend always returns a reason string, even on empty/null input", () => {
  for (const args of [[null, null], [[], []], [undefined, undefined]]) {
    const r = CA.recommend(args[0], args[1]);
    assert.equal(typeof r.reason, "string");
  }
});
