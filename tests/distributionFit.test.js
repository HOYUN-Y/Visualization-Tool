"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const DistFit = require("../js/distributionFit.js");

const Z975 = 1.959963984540054; // standard normal 0.975 quantile

test("normInv known-answer values", () => {
  assert.ok(Math.abs(DistFit.normInv(0.5) - 0) < 1e-9, "normInv(0.5) ~ 0");
  assert.ok(Math.abs(DistFit.normInv(0.975) - Z975) < 1e-4, "normInv(0.975) ~ 1.959964");
  assert.ok(Math.abs(DistFit.normInv(0.025) - -Z975) < 1e-4, "normInv(0.025) ~ -1.959964");
});

test("normInv domain edges", () => {
  assert.equal(DistFit.normInv(0), -Infinity);
  assert.equal(DistFit.normInv(1), Infinity);
  assert.ok(Number.isNaN(DistFit.normInv(1.5)));
  assert.ok(Number.isNaN(DistFit.normInv(-0.2)));
});

test("normInv is the inverse of normCdf (round-trip)", () => {
  [0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99].forEach((p) => {
    assert.ok(Math.abs(DistFit.normCdf(DistFit.normInv(p)) - p) < 1e-6, "round-trip p=" + p);
  });
});

test("normCdf known-answer values", () => {
  assert.ok(Math.abs(DistFit.normCdf(0) - 0.5) < 1e-9, "normCdf(0) ~ 0.5");
  assert.ok(Math.abs(DistFit.normCdf(Z975) - 0.975) < 1e-4, "normCdf(1.959964) ~ 0.975");
  assert.ok(Math.abs(DistFit.normCdf(-Z975) - 0.025) < 1e-4, "normCdf(-1.959964) ~ 0.025");
});

test("qqNormal shape and ordering", () => {
  const data = [5, -2, 0, 3, -1, 2, -3, 1, -5, 4]; // symmetric-ish
  const n = data.length;
  const res = DistFit.qqNormal(data);
  assert.equal(res.points.length, n, "length === n");
  // sorted ascending by sample
  for (let i = 1; i < n; i++) {
    assert.ok(res.points[i].sample >= res.points[i - 1].sample, "sample ascending");
    assert.ok(res.points[i].theoretical >= res.points[i - 1].theoretical, "theoretical ascending");
  }
  assert.ok(res.line.slope > 0, "line.slope > 0");
  assert.ok(Math.abs(res.line.intercept - 0.4) < 1e-9, "intercept = mean");
});

test("normalFit mean/std match hand computation (ddof=1)", () => {
  const data = [2, 4, 4, 4, 5, 5, 7, 9]; // classic sample: mean 5, ddof1 std ~2.13809
  const res = DistFit.normalFit(data);
  assert.ok(Math.abs(res.mean - 5) < 1e-12, "mean = 5");
  assert.ok(Math.abs(res.std - Math.sqrt(32 / 7)) < 1e-12, "std = sqrt(32/7)");
  assert.equal(res.min, 2);
  assert.equal(res.max, 9);
  assert.equal(res.pdf.length, 61, "60 steps => 61 points");
  // pdf y-values are non-negative and finite
  res.pdf.forEach((pt) => {
    assert.ok(pt.y >= 0 && isFinite(pt.y), "pdf y finite non-negative");
    assert.ok(pt.x >= res.min - 1e-9 && pt.x <= res.max + 1e-9, "pdf x in range");
  });
});

test("jarqueBera skewness ~ 0 for symmetric data", () => {
  const data = [-3, -2, -1, 0, 1, 2, 3];
  const res = DistFit.jarqueBera(data);
  assert.ok(Math.abs(res.skewness) < 1e-9, "skewness ~ 0 for symmetric data");
  assert.ok(res.statistic >= 0, "JB statistic non-negative");
  assert.ok(isFinite(res.kurtosis), "kurtosis finite");
});

test("histogram basic counts", () => {
  const data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const h = DistFit.histogram(data, 5);
  assert.equal(h.bins.length, 5, "5 bins");
  const total = h.bins.reduce((s, b) => s + b.count, 0);
  assert.equal(total, data.length, "all values counted");
  assert.ok(h.max >= 1, "max count >= 1");
  assert.equal(h.bins[0].x0, 0);
  assert.equal(h.bins[h.bins.length - 1].x1, 10, "last bin ends at max");
});

test("histogram degenerate (single value range)", () => {
  const h = DistFit.histogram([3, 3, 3], 10);
  assert.equal(h.bins.length, 1);
  assert.equal(h.bins[0].count, 3);
  assert.equal(h.max, 3);
});

test("cleaning drops null / empty / NaN inputs", () => {
  const res = DistFit.normalFit([1, null, "", NaN, 3, "2", undefined]);
  // cleaned = [1, 3, 2] => mean 2
  assert.ok(Math.abs(res.mean - 2) < 1e-12, "mean over cleaned values");
});
