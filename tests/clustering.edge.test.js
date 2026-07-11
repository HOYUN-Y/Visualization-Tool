const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const C = require(path.join(__dirname, "..", "js", "clustering.js"));

const three = [{ a: 0, b: 0 }, { a: 1, b: 1 }, { a: 5, b: 5 }];

// Regression: labelsAt(k) with k < 1 used to replay more merges than exist (merges.length === n-1)
// and crash with "Cannot destructure property 'a' of merges[m]".
test("hierarchical labelsAt(0) clamps to a single cluster (no crash)", () => {
  const h = C.hierarchical(three, ["a", "b"]);
  const l = h.labelsAt(0);
  assert.equal(new Set(l).size, 1);
});

test("hierarchical labelsAt with a negative k does not crash", () => {
  const h = C.hierarchical(three, ["a", "b"]);
  assert.doesNotThrow(() => h.labelsAt(-5));
  assert.equal(new Set(h.labelsAt(-5)).size, 1);
});

test("hierarchical labelsAt(k > n) clamps to n singleton clusters", () => {
  const h = C.hierarchical(three, ["a", "b"]);
  const l = h.labelsAt(99);
  assert.equal(new Set(l).size, 3);
});

test("hierarchical labelsAt(k) for valid k in [1, n] gives k clusters", () => {
  const h = C.hierarchical(three, ["a", "b"]);
  assert.equal(new Set(h.labelsAt(1)).size, 1);
  assert.equal(new Set(h.labelsAt(2)).size, 2);
  assert.equal(new Set(h.labelsAt(3)).size, 3);
});

test("hierarchical throws below 2 usable rows", () => {
  assert.throws(() => C.hierarchical([{ a: 1, b: 1 }], ["a", "b"]));
});

test("dbscan: all-identical points form one cluster; all-isolated points are noise", () => {
  const same = C.dbscan([{ a: 1, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 1 }], ["a", "b"], { eps: 0.5, minPts: 2 });
  assert.equal(new Set(same.labels).size, 1);
  assert.ok(same.labels.every((l) => l !== -1));

  // standardize:false so raw distances apply; otherwise rescaling shrinks the gaps.
  const far = C.dbscan([{ a: 0, b: 0 }, { a: 100, b: 100 }, { a: 500, b: 500 }], ["a", "b"], { eps: 1, minPts: 2, standardize: false });
  assert.ok(far.labels.every((l) => l === -1)); // every point is noise
});

test("dbscan on empty rows returns an empty labeling without crashing", () => {
  const r = C.dbscan([], ["a", "b"], { eps: 1, minPts: 2 });
  assert.deepEqual(r.labels, []);
});
