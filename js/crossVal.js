/* insight Analytics — pure k-fold cross-validation engine (window.CrossVal)
   Deterministic (seeded mulberry32 PRNG), no external deps.
   Mirrors the dual-mode pattern used by js/clustering.js. */
(function () {
  "use strict";

  // ── Seeded PRNG ────────────────────────────────────────────────────
  // mulberry32: fast, deterministic 32-bit generator seeded from an int.
  // Any shuffle uses this (never Math.random) so folds are reproducible.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fisher–Yates shuffle of a fresh 0..n-1 array using a seeded PRNG.
  function shuffledIndices(n, seed) {
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    const rand = mulberry32(seed);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    return idx;
  }

  // ── kFold ──────────────────────────────────────────────────────────
  // Returns k folds; indices 0..n-1 are seeded-shuffled then partitioned
  // into k contiguous test groups (balanced, sizes differ by <= 1).
  // Guards: k > n is clamped to n; k < 2 throws.
  function kFold(n, k, seed) {
    if (seed == null) seed = 1;
    if (!(n >= 1)) throw new Error("kFold: n must be >= 1");
    if (k < 2) throw new Error("kFold: k must be >= 2");
    if (k > n) k = n; // clamp: can't have more folds than samples

    const order = shuffledIndices(n, seed);
    const base = Math.floor(n / k);
    const rem = n % k; // first `rem` folds get one extra element

    const folds = [];
    let start = 0;
    for (let f = 0; f < k; f++) {
      const size = base + (f < rem ? 1 : 0);
      const testIdx = order.slice(start, start + size);
      const testSet = new Set(testIdx);
      const trainIdx = order.filter((v) => !testSet.has(v));
      folds.push({ trainIdx, testIdx });
      start += size;
    }
    return folds;
  }

  // ── crossValidate ──────────────────────────────────────────────────
  // For each fold: model = trainFn(trainRows, testRows);
  //                score = scoreFn(model, testRows).
  // NaN-handling: if trainFn or scoreFn throws (or returns a non-finite
  // number) for a fold, that fold's score is recorded as NaN and the run
  // continues. mean/std are computed over the FINITE fold scores only
  // (NaN folds are excluded from both). If no finite scores remain, mean
  // and std are NaN.
  function crossValidate(rows, k, trainFn, scoreFn, seed) {
    if (seed == null) seed = 1;
    const folds = kFold(rows.length, k, seed);
    const scores = [];

    for (const fold of folds) {
      let score = NaN;
      try {
        const trainRows = fold.trainIdx.map((i) => rows[i]);
        const testRows = fold.testIdx.map((i) => rows[i]);
        const model = trainFn(trainRows, testRows);
        const s = scoreFn(model, testRows);
        score = typeof s === "number" && isFinite(s) ? s : NaN;
      } catch (e) {
        score = NaN;
      }
      scores.push(score);
    }

    const finite = scores.filter((v) => typeof v === "number" && isFinite(v));
    const mean = finite.length
      ? finite.reduce((s, v) => s + v, 0) / finite.length
      : NaN;
    // Population standard deviation over the finite scores.
    const std = finite.length
      ? Math.sqrt(finite.reduce((s, v) => s + (v - mean) ** 2, 0) / finite.length)
      : NaN;

    return { mean, std, folds: scores, k: folds.length };
  }

  const api = { kFold, crossValidate };
  if (typeof window !== "undefined") window.CrossVal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
