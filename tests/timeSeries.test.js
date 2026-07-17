"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const TS = require("../js/timeSeries.js");

const TOL = 1e-9;

function approx(actual, expected, tol) {
  tol = tol === undefined ? TOL : tol;
  assert.equal(actual.length, expected.length, "length mismatch");
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const a = actual[i];
    if (e === null) {
      assert.equal(a, null, "index " + i + " expected null, got " + a);
    } else {
      assert.ok(a !== null && a !== undefined, "index " + i + " expected number, got null");
      assert.ok(Math.abs(a - e) <= tol, "index " + i + " expected " + e + " got " + a);
    }
  }
}

test("movingAverage known answer", () => {
  approx(TS.movingAverage([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test("movingAverage window=1 is identity", () => {
  approx(TS.movingAverage([1, 2, 3], 1), [1, 2, 3]);
});

test("movingAverage throws for window < 1", () => {
  assert.throws(() => TS.movingAverage([1, 2, 3], 0));
  assert.throws(() => TS.movingAverage([1, 2, 3], -2));
});

test("weightedMovingAverage normalizes weights", () => {
  // window of 2, weights [1,1] -> simple MA of last 2
  approx(TS.weightedMovingAverage([2, 4, 6], [1, 1]), [null, 3, 5]);
  // weights [1,3] applied to [2,4] -> (2*1 + 4*3)/4 = 14/4 = 3.5
  approx(TS.weightedMovingAverage([2, 4, 6], [1, 3]), [null, 3.5, 5.5]);
});

test("exponentialSmoothing constant series returns same", () => {
  approx(TS.exponentialSmoothing([10, 10, 10], 0.5), [10, 10, 10]);
});

test("exponentialSmoothing alpha=1 returns the input", () => {
  approx(TS.exponentialSmoothing([3, 1, 4, 1, 5], 1), [3, 1, 4, 1, 5]);
});

test("exponentialSmoothing alpha validation throws", () => {
  assert.throws(() => TS.exponentialSmoothing([1, 2, 3], 0));
  assert.throws(() => TS.exponentialSmoothing([1, 2, 3], 1.5));
  assert.throws(() => TS.exponentialSmoothing([1, 2, 3], -0.1));
});

test("exponentialSmoothing known recursion", () => {
  // s0=1; s1=0.5*2+0.5*1=1.5; s2=0.5*3+0.5*1.5=2.25
  approx(TS.exponentialSmoothing([1, 2, 3], 0.5), [1, 1.5, 2.25]);
});

test("doubleExponential shape and perfect linear fit", () => {
  const res = TS.doubleExponential([1, 2, 3, 4, 5], 0.5, 0.5);
  assert.ok(Array.isArray(res.level));
  assert.ok(Array.isArray(res.trend));
  assert.ok(Array.isArray(res.fitted));
  assert.equal(res.level.length, 5);
  assert.equal(res.trend.length, 5);
  assert.equal(res.fitted.length, 5);
  // perfectly linear series: fitted should track the line closely by the end
  assert.ok(Math.abs(res.fitted[4] - 5) < 1e-6);
});

test("diff known answer", () => {
  approx(TS.diff([1, 3, 6, 10]), [null, 2, 3, 4]);
});

test("diff with lag=2", () => {
  approx(TS.diff([1, 3, 6, 10], 2), [null, null, 5, 7]);
});

test("acf lag0 is 1 and bounded", () => {
  const a = TS.acf([1, 2, 3, 4, 5, 4, 3, 2, 1], 4);
  assert.equal(a.length, 5);
  assert.equal(a[0], 1);
  for (let k = 0; k < a.length; k++) {
    assert.ok(Math.abs(a[k]) <= 1 + 1e-9, "acf[" + k + "]=" + a[k] + " out of [-1,1]");
  }
});

test("acf of constant series: lag0=1", () => {
  const a = TS.acf([5, 5, 5, 5], 2);
  assert.equal(a[0], 1);
});

// ── missing values must not shift the lag structure (PLAN §12 E4) ──────────────────
// acf used to compact out nulls, shifting every later observation one slot earlier — a single gap
// then broke the phase and quietly weakened the very seasonality ACF is used to detect. Now positions
// are preserved and pairwise deletion drops only the straddling terms.
test("acf: a single gap barely moves a strong seasonal signal (no lag shift)", () => {
  const clean = [];
  for (let i = 0; i < 40; i++) clean.push([10, 20, 30, 20][i % 4]); // period-4 seasonality
  const gapped = clean.slice(); gapped[10] = null;

  const c = TS.acf(clean, 8)[4];
  const g = TS.acf(gapped, 8)[4];
  assert.ok(c > 0.85, `clean lag4 should be strong, got ${c}`);
  // Before the fix a single gap dropped this from 0.90 to 0.79; positional pairwise keeps it close.
  assert.ok(Math.abs(c - g) < 0.08, `one gap should barely move lag4: clean ${c} vs gapped ${g}`);
  assert.ok(g > 0.8, `gapped lag4 should still read as seasonal, got ${g}`);
});

test("acf: adding more gaps does not progressively corrupt the lag (no cumulative shift)", () => {
  const base = [];
  for (let i = 0; i < 40; i++) base.push([10, 20, 30, 20][i % 4]);
  const oneGap = base.slice(); oneGap[10] = null;
  const twoGap = base.slice(); twoGap[10] = null; twoGap[25] = null;
  // With compaction each extra gap shifted the tail further (0.79 → 0.68); with pairwise deletion the
  // lag-4 estimate barely moves — the only change is a slightly different mean from one fewer value,
  // not a phase shift. So the two must agree to well under a percent.
  assert.ok(Math.abs(TS.acf(oneGap, 8)[4] - TS.acf(twoGap, 8)[4]) < 0.01,
    "gap count must not change which observations line up at lag 4");
});

test("acf: no-gap results are unchanged by the rewrite (biased estimator preserved)", () => {
  // Alternating series: lag1 autocorrelation is strongly negative. Locks the exact no-gap value so the
  // positional rewrite can't silently drift from the original dense-array estimator.
  const alt = [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1];
  assert.ok(Math.abs(TS.acf(alt, 2)[1] - (-11 / 12)) < 1e-9, `expected -11/12, got ${TS.acf(alt, 2)[1]}`);
});

test("pacf[0]===1 and length maxLag+1", () => {
  const p = TS.pacf([1, 2, 3, 4, 5, 4, 3, 2, 1], 4);
  assert.equal(p[0], 1);
  assert.equal(p.length, 5);
});

test("pacf lag1 equals acf lag1", () => {
  const series = [1, 2, 3, 2, 1, 2, 3, 2, 1];
  const a = TS.acf(series, 3);
  const p = TS.pacf(series, 3);
  assert.ok(Math.abs(p[1] - a[1]) < 1e-9);
});

test("rollingStd known answer", () => {
  // window 2 of [1,2,3,4]: pairwise sample std of consecutive = sqrt(0.5) each
  const s = Math.sqrt(0.5);
  approx(TS.rollingStd([1, 2, 3, 4], 2), [null, s, s, s]);
});

test("rollingStd constant window is zero", () => {
  approx(TS.rollingStd([5, 5, 5, 5], 3), [null, null, 0, 0]);
});
