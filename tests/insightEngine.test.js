const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const IE = require(path.join(__dirname, "..", "js", "insightEngine.js"));

// js/insightEngine.js had no test file — not because it was low-risk (it's the auto-interpretation the
// user reads on every dataset), but because it lacked the dual-mode module.exports that makes require()
// possible under Node (same root cause as statsMath.js). These lock the pure summarize* functions and
// the profile's column-coverage honesty (PLAN §12 E2). profileDataset() reads window.Store and can't
// run under Node — it's covered by the browser E2E instead.

// ── summarizeRegression: adjective cutoffs + significance wording ──────────────────
test("summarizeRegression: quality adjective tracks R²", () => {
  const mk = (r2) => IE.summarizeRegression({ r2, adj: r2, terms: [], target: "y", pF: 0.5 });
  assert.match(mk(0.85), /excellent/);
  assert.match(mk(0.70), /good/);
  assert.match(mk(0.50), /moderate/);
  assert.match(mk(0.20), /weak/);
});

test("summarizeRegression: reports significant predictors and overall model p", () => {
  const s = IE.summarizeRegression({
    r2: 0.7, adj: 0.68, target: "price", pF: 0.00001,
    terms: [{ name: "(Intercept)", p: 0.9 }, { name: "area", p: 0.001 }, { name: "floor", p: 0.3 }],
  });
  assert.match(s, /area/);
  assert.doesNotMatch(s, /floor/); // p=0.3 is not significant
  assert.match(s, /< \.0001/);
});

test("summarizeRegression: says so when nothing is significant", () => {
  const s = IE.summarizeRegression({ r2: 0.1, adj: 0.05, target: "y", pF: 0.4,
    terms: [{ name: "(Intercept)", p: 0.9 }, { name: "x", p: 0.6 }] });
  assert.match(s, /No individual predictor/);
});

// ── summarizeClassification: per-class precision/recall from the confusion matrix ──
test("summarizeClassification: computes per-class P/R from the confusion matrix", () => {
  // 2-class, perfect diagonal → P=R=100% for both.
  const s = IE.summarizeClassification({ acc: 1.0, k: 3, classes: ["a", "b"], cm: [[5, 0], [0, 5]] });
  assert.match(s, /excellent/);
  assert.match(s, /P=100%\/R=100%/);
});

test("summarizeClassification: accuracy adjective cutoffs", () => {
  const mk = (acc) => IE.summarizeClassification({ acc, k: 1, classes: ["a"], cm: [[1]] });
  assert.match(mk(0.95), /excellent/);
  assert.match(mk(0.8), /good/);
  assert.match(mk(0.65), /fair/);
  assert.match(mk(0.4), /poor/);
});

// ── summarizeClustering: imbalance detection ───────────────────────────────────────
test("summarizeClustering: flags an imbalanced partition", () => {
  assert.match(IE.summarizeClustering({ K: 2, sizes: [90, 10], inertia: 100 }), /imbalanced/);
  assert.match(IE.summarizeClustering({ K: 2, sizes: [55, 45], inertia: 100 }), /balanced/);
});

// ── recommendNextStep: routing ─────────────────────────────────────────────────────
test("recommendNextStep: routes by lastTest and reacts to weak R²", () => {
  assert.match(IE.recommendNextStep({ lastTest: "corr" }).text, /Regression/);
  assert.match(IE.recommendNextStep({ lastTest: "reg", lastResult: { r2: 0.3 } }).text, /outliers/);
  assert.match(IE.recommendNextStep({ lastTest: "reg", lastResult: { r2: 0.9 } }).text, /ML Studio/);
  assert.ok(IE.recommendNextStep({ lastTest: "unknown" }).text); // has a default
});

// ── E2: the correlation cap is real and bounded ────────────────────────────────────
test("E2: CORR_SCAN_LIMIT is exported so the cap is a named, testable constant", () => {
  assert.equal(typeof IE.CORR_SCAN_LIMIT, "number");
  assert.ok(IE.CORR_SCAN_LIMIT >= 2);
});
