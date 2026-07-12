"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CrossVal = require("../js/crossVal.js");

const close = (a, b, t = 1e-9) =>
  assert.ok(Math.abs(a - b) <= t, `${a} !~= ${b} (tol ${t})`);

// Rows with a single numeric column "v".
function makeRows(vals) {
  return vals.map((v) => ({ v }));
}

test("public API is present", () => {
  assert.equal(typeof CrossVal.kFold, "function");
  assert.equal(typeof CrossVal.crossValidate, "function");
});

test("kFold(10, 5, 1): 5 folds, each testIdx length 2, full disjoint cover", () => {
  const folds = CrossVal.kFold(10, 5, 1);
  assert.equal(folds.length, 5);

  const seen = new Set();
  for (const fold of folds) {
    assert.equal(fold.testIdx.length, 2);
    for (const i of fold.testIdx) {
      assert.ok(i >= 0 && i < 10, `index ${i} out of range`);
      assert.ok(!seen.has(i), `index ${i} appears in more than one testIdx`);
      seen.add(i);
    }
  }
  // Union of all testIdx == {0..9} exactly once.
  assert.equal(seen.size, 10);
  for (let i = 0; i < 10; i++) assert.ok(seen.has(i), `missing index ${i}`);
});

test("kFold: trainIdx is the exact complement of testIdx", () => {
  const folds = CrossVal.kFold(10, 5, 1);
  for (const fold of folds) {
    const testSet = new Set(fold.testIdx);
    assert.equal(fold.trainIdx.length, 8);
    // No overlap between train and test.
    for (const i of fold.trainIdx) assert.ok(!testSet.has(i));
    // Train ∪ Test == {0..9}.
    const all = new Set([...fold.trainIdx, ...fold.testIdx]);
    assert.equal(all.size, 10);
    for (let i = 0; i < 10; i++) assert.ok(all.has(i));
  }
});

test("kFold is deterministic: same seed → identical folds", () => {
  const a = CrossVal.kFold(10, 5, 1);
  const b = CrossVal.kFold(10, 5, 1);
  assert.deepEqual(a, b);
});

test("kFold: different seeds generally differ", () => {
  const a = CrossVal.kFold(10, 5, 1);
  const b = CrossVal.kFold(10, 5, 2);
  assert.notDeepEqual(a, b);
});

test("kFold: balanced sizes differ by at most 1", () => {
  const folds = CrossVal.kFold(11, 3, 7); // sizes 4,4,3
  const sizes = folds.map((f) => f.testIdx.length).sort();
  assert.equal(sizes[sizes.length - 1] - sizes[0] <= 1, true);
  assert.equal(sizes.reduce((s, v) => s + v, 0), 11); // full cover
});

test("kFold: k > n is clamped to n", () => {
  const folds = CrossVal.kFold(4, 10, 1);
  assert.equal(folds.length, 4);
  for (const fold of folds) assert.equal(fold.testIdx.length, 1); // leave-one-out
});

test("kFold: k < 2 throws", () => {
  assert.throws(() => CrossVal.kFold(10, 1, 1));
  assert.throws(() => CrossVal.kFold(10, 0, 1));
});

test("crossValidate: constant scoreFn → mean = value, std = 0", () => {
  const rows = makeRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // trainFn returns the mean of column v over the train rows.
  const trainFn = (trainRows) =>
    trainRows.reduce((s, r) => s + r.v, 0) / trainRows.length;
  const scoreFn = () => 0.8;

  const res = CrossVal.crossValidate(rows, 5, trainFn, scoreFn, 1);
  assert.equal(res.k, 5);
  assert.equal(res.folds.length, 5);
  close(res.mean, 0.8);
  close(res.std, 0);
});

test("crossValidate: varying scoreFn → correct mean and population std", () => {
  const rows = makeRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // Score = number of test rows (folds of size 2 → every score is 2).
  // To force variation, score = sum of test-row values instead.
  const trainFn = () => null;
  const scoreFn = (_m, testRows) => testRows.reduce((s, r) => s + r.v, 0);

  const res = CrossVal.crossValidate(rows, 5, trainFn, scoreFn, 1);
  const s = res.folds;
  assert.equal(s.length, 5);
  // All fold scores are finite.
  s.forEach((v) => assert.ok(isFinite(v)));

  // Independently recompute expected mean/std over the same folds.
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const std = Math.sqrt(
    s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length
  );
  close(res.mean, mean);
  close(res.std, std);

  // Sum of all fold scores == sum of all values (each value scored once).
  const total = rows.reduce((a, r) => a + r.v, 0);
  close(s.reduce((a, b) => a + b, 0), total);
});

test("crossValidate: known values give exact mean/std", () => {
  // Two-element rows, k=2 → each fold's test set is one element.
  const rows = makeRows([10, 20, 30, 40]);
  const trainFn = () => null;
  // Deterministic score independent of shuffle: sum over test rows.
  const scoreFn = (_m, testRows) => testRows.reduce((s, r) => s + r.v, 0);
  const res = CrossVal.crossValidate(rows, 2, trainFn, scoreFn, 3);
  // Two folds partition {10,20,30,40}; each fold sums a disjoint half.
  // Total is 100, split into two halves h and 100-h. mean is always 50.
  close(res.mean, 50);
});

test("crossValidate: a fold where trainFn throws → NaN, mean over the rest", () => {
  const rows = makeRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  let calls = 0;
  const trainFn = () => {
    calls++;
    if (calls === 2) throw new Error("boom on fold 2");
    return null;
  };
  const scoreFn = () => 1.0;

  const res = CrossVal.crossValidate(rows, 5, trainFn, scoreFn, 1);
  assert.equal(res.folds.length, 5);
  // Exactly one fold is NaN.
  const nanCount = res.folds.filter((v) => Number.isNaN(v)).length;
  assert.equal(nanCount, 1);
  assert.ok(Number.isNaN(res.folds[1]));
  // Mean is over the 4 surviving folds, all 1.0.
  close(res.mean, 1.0);
  close(res.std, 0);
});

test("crossValidate: a fold where scoreFn throws → NaN and continues", () => {
  const rows = makeRows([1, 2, 3, 4, 5, 6]);
  let calls = 0;
  const trainFn = () => null;
  const scoreFn = () => {
    calls++;
    if (calls === 1) throw new Error("scoring failed");
    return 2.0;
  };

  const res = CrossVal.crossValidate(rows, 3, trainFn, scoreFn, 1);
  assert.equal(res.folds.length, 3);
  assert.ok(Number.isNaN(res.folds[0]));
  close(res.mean, 2.0); // over the two finite folds
});

test("crossValidate: scoreFn returning non-finite is treated as NaN", () => {
  const rows = makeRows([1, 2, 3, 4]);
  const res = CrossVal.crossValidate(rows, 2, () => null, () => Infinity, 1);
  res.folds.forEach((v) => assert.ok(Number.isNaN(v)));
  assert.ok(Number.isNaN(res.mean));
  assert.ok(Number.isNaN(res.std));
});
