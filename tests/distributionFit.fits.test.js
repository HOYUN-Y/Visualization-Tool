const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const DF = require(path.join(__dirname, "..", "js", "distributionFit.js"));

// Deterministic samples via inverse-CDF over evenly spaced probabilities (no RNG).
function normalSample(n, mu, sd) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(mu + sd * DF.normInv(i / (n + 1)));
  return out;
}
function exponentialSample(n, rate) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(-Math.log(1 - i / (n + 1)) / rate);
  return out;
}

test("exponentialFit recovers the rate on exponential data", () => {
  const data = exponentialSample(200, 0.5); // mean 2 → rate 0.5
  const f = DF.exponentialFit(data);
  assert.equal(f.ok, true);
  assert.ok(Math.abs(f.params.rate - 0.5) < 0.1);
});

test("exponentialFit / lognormalFit reject non-positive data", () => {
  assert.equal(DF.exponentialFit([1, -2, 3]).ok, false);
  assert.equal(DF.lognormalFit([0, 1, 2]).ok, false);
});

test("lognormalFit recovers log-space params on lognormal data", () => {
  const logs = normalSample(200, 1, 0.5);
  const data = logs.map((v) => Math.exp(v));
  const f = DF.lognormalFit(data);
  assert.equal(f.ok, true);
  assert.ok(Math.abs(f.params.logMean - 1) < 0.15);
  assert.ok(Math.abs(f.params.logStd - 0.5) < 0.15);
});

test("compareFits picks normal for normal data and exponential for exponential data", () => {
  const normal = normalSample(200, 50, 8); // positive so all three apply
  assert.equal(DF.compareFits(normal).best, "normal");

  const expo = exponentialSample(200, 0.3);
  assert.equal(DF.compareFits(expo).best, "exponential");
});

test("compareFits still returns normal when data has non-positive values (exp/lognormal skipped)", () => {
  const withNeg = normalSample(100, 0, 5); // straddles zero
  const r = DF.compareFits(withNeg);
  assert.equal(r.best, "normal");
  assert.ok(r.fits.every((f) => f.dist === "normal")); // exp/lognormal correctly skipped
});

test("fits degrade on tiny/constant input without throwing", () => {
  assert.equal(DF.exponentialFit([5]).ok, false);
  assert.equal(DF.lognormalFit([2, 2, 2]).ok, false); // zero log-variance
  assert.doesNotThrow(() => DF.compareFits([]));
});
