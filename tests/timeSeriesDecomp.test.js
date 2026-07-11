const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const TS = require(path.join(__dirname, "..", "js", "timeSeriesDecomp.js"));

// Build a known signal: linear trend + period-4 seasonal pattern, no noise.
const period = 4;
const seasonPattern = [10, -5, 3, -8]; // sums to 0
const y = [];
for (let i = 0; i < 40; i++) y.push(100 + 2 * i + seasonPattern[i % period]);

test("additive decomposition recovers the seasonal pattern (indices sum to ~0)", () => {
  const r = TS.decompose(y, { period, model: "additive" });
  assert.equal(r.model, "additive");
  assert.equal(r.period, 4);
  const sum = r.seasonalIndices.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum) < 1e-9, "seasonal indices sum to zero");
  // recovered indices should match the injected pattern (same shape)
  for (let k = 0; k < period; k++) {
    assert.ok(Math.abs(r.seasonalIndices[k] - seasonPattern[k]) < 1e-6, `index ${k}`);
  }
});

test("additive: trend + seasonal + residual reconstructs the series where trend is defined", () => {
  const r = TS.decompose(y, { period, model: "additive" });
  for (let i = 0; i < y.length; i++) {
    if (r.trend[i] == null) continue;
    const recon = r.trend[i] + r.seasonal[i] + r.residual[i];
    assert.ok(Math.abs(recon - y[i]) < 1e-6, `reconstruct index ${i}`);
    assert.ok(Math.abs(r.residual[i]) < 1e-6, "residual ~0 for a clean signal");
  }
});

test("multiplicative decomposition: seasonal indices average to ~1", () => {
  const my = [];
  const mPattern = [1.2, 0.8, 1.1, 0.9];
  for (let i = 0; i < 40; i++) my.push((100 + 2 * i) * mPattern[i % period]);
  const r = TS.decompose(my, { period, model: "multiplicative" });
  const mean = r.seasonalIndices.reduce((a, b) => a + b, 0) / period;
  assert.ok(Math.abs(mean - 1) < 1e-9, "indices average to 1");
  // reconstruction y = trend * seasonal * residual
  for (let i = 0; i < my.length; i++) {
    if (r.trend[i] == null) continue;
    const recon = r.trend[i] * r.seasonal[i] * r.residual[i];
    assert.ok(Math.abs(recon - my[i]) < 1e-6, `reconstruct index ${i}`);
  }
});

test("odd period uses a simple centered MA and still recovers the pattern", () => {
  const p = 3, pat = [5, -2, -3];
  const oy = [];
  for (let i = 0; i < 30; i++) oy.push(50 + i + pat[i % p]);
  const r = TS.decompose(oy, { period: p });
  for (let k = 0; k < p; k++) assert.ok(Math.abs(r.seasonalIndices[k] - pat[k]) < 1e-6);
});

test("trend endpoints are null (insufficient window) but interior is filled", () => {
  const r = TS.decompose(y, { period, model: "additive" });
  assert.equal(r.trend[0], null);
  assert.equal(r.trend[y.length - 1], null);
  assert.ok(r.trend.some((t) => t != null));
});

test("degrade: period < 2 and < 2 full periods of data throw clearly", () => {
  assert.throws(() => TS.decompose(y, { period: 1 }), /period >= 2/);
  assert.throws(() => TS.decompose([1, 2, 3, 4, 5], { period: 4 }), /2 full periods/);
});
