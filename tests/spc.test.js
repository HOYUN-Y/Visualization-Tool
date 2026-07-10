const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const SPC = require(path.join(__dirname, "..", "js", "spc.js"));
const close = (a, b, t = 1e-3) => assert.ok(Math.abs(a - b) <= t, `${a} ≈ ${b}`);

test("I-MR chart limits from moving-range sigma", () => {
  const r = SPC.iMR([1, 2, 3, 4, 5]);
  close(r.individuals.center, 3);
  close(r.movingRange.center, 1);
  close(r.individuals.sigma, 1 / 1.128);
  close(r.individuals.ucl, 3 + 3 * (1 / 1.128));
  close(r.movingRange.ucl, 3.267);      // D4(2) * MRbar(1)
  close(r.movingRange.lcl, 0);
});

test("X-bar/R chart uses A2/D4 constants", () => {
  const r = SPC.xbarR([[2, 4], [4, 6]]);
  close(r.xbar.center, 4);
  close(r.range.center, 2);
  close(r.xbar.ucl, 4 + 1.88 * 2);      // 7.76
  close(r.xbar.lcl, 4 - 1.88 * 2);      // 0.24
  close(r.range.ucl, 3.267 * 2);        // 6.534
});

test("X-bar/S chart returns S limits", () => {
  const r = SPC.xbarS([[2, 4, 6], [3, 5, 7]]);
  assert.equal(r.n, 3);
  assert.ok(r.s.center > 0 && r.s.ucl > r.s.center);
});

test("capability Cp/Cpk/Pp/Ppk computed with within and overall sigma", () => {
  const c = SPC.capability([9, 11, 10, 12, 8], 4, 16);
  assert.ok(c.cp > 0 && c.cpk > 0 && c.pp > 0 && c.ppk > 0);
  close(c.mean, 10);
  // within = MRbar/d2, MRbar = mean(|2,1,2,4|)=2.25
  close(c.withinSigma, 2.25 / 1.128);
  close(c.cp, 12 / (6 * (2.25 / 1.128)), 1e-2);
});

test("p-chart and c-chart proportions and limits", () => {
  const p = SPC.pChart([2, 4], [100, 100]);
  close(p.center, 0.03);
  assert.deepEqual(p.points, [0.02, 0.04]);
  assert.ok(p.limits[0].ucl > 0.03 && p.limits[0].lcl >= 0);
  const c = SPC.cChart([4, 9, 16]);
  close(c.center, 29 / 3);
});

test("Pareto sorts descending with cumulative reaching 100%", () => {
  const p = SPC.pareto([{ label: "a", value: 1 }, { label: "b", value: 3 }, { label: "c", value: 6 }]);
  assert.deepEqual(p.map((x) => x.label), ["c", "b", "a"]);
  close(p[p.length - 1].cumulativePct, 100);
  close(p[0].pct, 60);
});

test("violations flags points beyond limits", () => {
  const idx = SPC.violations([1, 2, 20, 3], 3, 10, -4);
  assert.deepEqual(idx, [2]);
});
