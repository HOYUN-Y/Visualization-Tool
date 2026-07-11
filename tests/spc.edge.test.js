const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const S = require(path.join(__dirname, "..", "js", "spc.js"));

// --- X-bar/R · S: empty/degenerate subgroups must not leak Infinity/NaN ---
test("xbarR throws on an empty subgroup instead of emitting Infinity limits", () => {
  assert.throws(() => S.xbarR([[], []]), /size/);
  assert.throws(() => S.xbarR([[1, 2], []]), /size/); // one bad subgroup used to poison the whole chart
});

test("xbarR/xbarS reject size-1 subgroups (those belong on I-MR)", () => {
  assert.throws(() => S.xbarR([[1], [2], [3]]), /size/);
  assert.throws(() => S.xbarS([[1], [2], [3]]), /size/);
});

test("xbarR rejects unequal-size subgroups", () => {
  assert.throws(() => S.xbarR([[1, 2, 3], [1, 2]]), /equal-size/);
});

test("xbarR/xbarS produce finite limits on valid subgroups", () => {
  const r = S.xbarR([[1, 2, 3], [2, 3, 4], [1, 2, 2]]);
  assert.ok([r.xbar.ucl, r.xbar.lcl, r.range.ucl, r.range.lcl].every(Number.isFinite));
  const s = S.xbarS([[1, 2, 3], [2, 3, 4], [1, 2, 2]]);
  assert.ok([s.xbar.ucl, s.xbar.lcl, s.s.ucl].every(Number.isFinite));
});

// --- p/u charts: zero subgroup size must not divide-by-zero ---
test("pChart with a zero subgroup size yields null (not Infinity) for that point", () => {
  const r = S.pChart([1, 2], [0, 10]);
  assert.equal(r.points[0], null);
  assert.equal(r.limits[0].ucl, null);
  assert.equal(r.points[1], 0.2);
  assert.ok(Number.isFinite(r.center));
});

test("pChart with all sizes zero yields a null center (not NaN)", () => {
  const r = S.pChart([0, 0], [0, 0]);
  assert.equal(r.center, null);
  assert.ok(r.points.every((p) => p === null));
});

test("uChart with a zero subgroup size yields null for that point", () => {
  const r = S.uChart([1, 2], [0, 10]);
  assert.equal(r.points[0], null);
  assert.equal(r.limits[0].ucl, null);
  assert.equal(r.points[1], 0.2);
});

// --- capability: inverted spec must not return negative indices ---
test("capability with an inverted spec (lsl > usl) returns null indices", () => {
  const c = S.capability([1, 2, 3, 4, 5], 10, 2);
  assert.equal(c.cp, null);
  assert.equal(c.cpk, null);
  assert.equal(c.pp, null);
  assert.equal(c.ppk, null);
});

test("capability with a valid two-sided spec returns numeric indices", () => {
  const c = S.capability([1, 2, 3, 4, 5], 0, 6);
  assert.equal(typeof c.cp, "number");
  assert.ok(c.cp > 0);
});

test("capability with a one-sided spec returns a one-sided cpk and null cp", () => {
  const c = S.capability([1, 2, 3, 4, 5], null, 10);
  assert.equal(c.cp, null); // no bilateral spec
  assert.equal(typeof c.cpk, "number");
});

test("capability with constant values (sigma 0) returns null indices, no Infinity", () => {
  const c = S.capability([5, 5, 5, 5], 0, 10);
  assert.equal(c.cp, null);
  assert.equal(c.cpk, null);
});

test("pareto handles empty and all-zero inputs", () => {
  assert.deepEqual(S.pareto([]), []);
  const z = S.pareto([{ label: "a", value: 0 }, { label: "b", value: 0 }]);
  assert.ok(z.every((x) => x.pct === 0));
});
