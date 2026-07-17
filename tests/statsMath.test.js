const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const SM = require(path.join(__dirname, "..", "js", "statsMath.js"));

// js/statsMath.js feeds EVERY p-value in the app (t/F/chi²) and the (XtX)^-1 behind regression standard
// errors. It went untested for the whole project because it lacked the dual-mode `module.exports` that
// every other engine has — not because it was low-risk. These lock the parts that can silently lie.

// ── matInverse: singularity must be reported, never fudged ─────────────────────────
// Regression: matInverse used `const piv = A[c][c] || 1e-9`, substituting a zero pivot with 1e-9 and
// returning a huge-but-finite garbage inverse indistinguishable from a real one.
test("matInverse: inverts a well-conditioned matrix", () => {
  const inv = SM.matInverse([[4, 7], [2, 6]]);
  assert.ok(inv, "must not report a well-conditioned matrix as singular");
  // exact inverse: [[0.6,-0.7],[-0.2,0.4]]
  assert.ok(Math.abs(inv[0][0] - 0.6) < 1e-12);
  assert.ok(Math.abs(inv[0][1] + 0.7) < 1e-12);
  assert.ok(Math.abs(inv[1][0] + 0.2) < 1e-12);
  assert.ok(Math.abs(inv[1][1] - 0.4) < 1e-12);
});

test("matInverse: A · A⁻¹ = I", () => {
  const A = [[2, 1, 1], [1, 3, 2], [1, 0, 0]];
  const inv = SM.matInverse(A);
  assert.ok(inv);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const v = A[i].reduce((s, a, k) => s + a * inv[k][j], 0);
      assert.ok(Math.abs(v - (i === j ? 1 : 0)) < 1e-10, `I[${i}][${j}] = ${v}`);
    }
  }
});

test("matInverse: returns null on an exactly singular matrix (no fudged pivot)", () => {
  // col2 = 2 × col1 — exactly rank-deficient.
  assert.equal(SM.matInverse([[1, 2], [2, 4]]), null);
});

test("matInverse: returns null on the dummy variable trap (intercept + all levels)", () => {
  // The real reachable path: Clean's dummy_encode emits a column per level (store.jsx:233, no
  // drop-first) and regression prepends an intercept (statsMode.jsx:88). The dummy columns then sum
  // exactly to the intercept column, so XtX is singular. Build XtX for X = [1, d1, d2, d3] over 60 rows
  // cycling through 3 levels, exactly as regression() does.
  const rows = [];
  for (let i = 0; i < 60; i++) { const lv = i % 3; rows.push([1, lv === 0 ? 1 : 0, lv === 1 ? 1 : 0, lv === 2 ? 1 : 0]); }
  const p = 4;
  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  for (const x of rows) for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) XtX[a][b] += x[a] * x[b];
  assert.equal(SM.matInverse(XtX), null, "dummy variable trap must be reported, not silently inverted");
});

test("matInverse: singularity check is relative to matrix scale", () => {
  // XtX entries reach ~1e13 in this app (won prices squared, summed over rows). A fixed absolute cutoff
  // would never fire at that scale, and would reject healthy pivots at tiny scale. Both must hold.
  const bigSingular = [[1e13, 2e13], [2e13, 4e13]];
  assert.equal(SM.matInverse(bigSingular), null, "large-scale singular matrix must be caught");

  const smallHealthy = [[1e-8, 0], [0, 2e-8]];
  const inv = SM.matInverse(smallHealthy);
  assert.ok(inv, "small-scale well-conditioned matrix must NOT be called singular");
  assert.ok(Math.abs(inv[0][0] - 1e8) / 1e8 < 1e-9);
});

test("matInverse: null rather than NaN-filled output on a zero matrix", () => {
  assert.equal(SM.matInverse([[0, 0], [0, 0]]), null);
});

// ── p-value functions ──────────────────────────────────────────────────────────────
test("tP: two-tailed t p-values match known values", () => {
  // t=0 → p=1 regardless of df
  assert.ok(Math.abs(SM.tP(0, 10) - 1) < 1e-12);
  // t=2.228, df=10 → p ≈ 0.05 (standard table)
  assert.ok(Math.abs(SM.tP(2.228, 10) - 0.05) < 1e-3);
  // symmetric in sign
  assert.ok(Math.abs(SM.tP(2.228, 10) - SM.tP(-2.228, 10)) < 1e-12);
  // larger |t| → smaller p
  assert.ok(SM.tP(4, 10) < SM.tP(2, 10));
});

test("chiP: upper-tail chi-square p-values match known values", () => {
  // χ²=3.841, df=1 → p ≈ 0.05
  assert.ok(Math.abs(SM.chiP(3.841, 1) - 0.05) < 1e-3);
  // χ²=5.991, df=2 → p ≈ 0.05
  assert.ok(Math.abs(SM.chiP(5.991, 2) - 0.05) < 1e-3);
  assert.ok(SM.chiP(20, 2) < SM.chiP(5, 2));
});

test("fP: upper-tail F p-values match known values", () => {
  // F=4.965, df=(1,10) → p ≈ 0.05
  assert.ok(Math.abs(SM.fP(4.965, 1, 10) - 0.05) < 1e-3);
  assert.ok(SM.fP(10, 3, 20) < SM.fP(2, 3, 20));
});

test("gammln: matches known log-gamma values", () => {
  // Γ(1)=1 → ln=0 ; Γ(5)=24 → ln≈3.1781
  assert.ok(Math.abs(SM.gammln(1) - 0) < 1e-9);
  assert.ok(Math.abs(SM.gammln(5) - Math.log(24)) < 1e-9);
  assert.ok(Math.abs(SM.gammln(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-9);
});

test("gammp / gammq are complementary", () => {
  for (const [a, x] of [[1, 0.5], [2, 3], [5, 4]]) {
    assert.ok(Math.abs(SM.gammp(a, x) + SM.gammq(a, x) - 1) < 1e-10, `a=${a} x=${x}`);
  }
});

// ── skewness / kurtosis ────────────────────────────────────────────────────────────
test("skewness: symmetric data ≈ 0, right-skewed > 0", () => {
  assert.ok(Math.abs(SM.skewness([1, 2, 3, 4, 5])) < 1e-9);
  assert.ok(SM.skewness([1, 1, 1, 1, 10]) > 1);
  assert.ok(SM.skewness([1, 10, 10, 10, 10]) < -1);
});

test("kurtosis: excess kurtosis of a flat set is negative", () => {
  assert.ok(SM.kurtosis([1, 2, 3, 4, 5]) < 0);
});

test("skewness / kurtosis: degrade to null on too-few points rather than NaN", () => {
  for (const f of [SM.skewness, SM.kurtosis]) {
    const r = f([1, 2]);
    assert.ok(r === null || Number.isFinite(r), "must be null or finite, never NaN");
  }
});
