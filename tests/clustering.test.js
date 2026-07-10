const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const Clustering = require(path.join(__dirname, "..", "js", "clustering.js"));

const KEYS = ["x", "y"];
// two well-separated blobs
const ROWS = [
  { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 },
  { x: 10, y: 10 }, { x: 10.5, y: 10 }, { x: 10, y: 10.5 },
];

test("DBSCAN finds two well-separated clusters with no noise", () => {
  const r = Clustering.dbscan(ROWS, KEYS, { eps: 1.5, minPts: 2, standardize: false });
  assert.equal(r.clusters, 2);
  assert.equal(r.noise, 0);
  // first three share a label, last three share another
  assert.equal(r.labels[0], r.labels[1]);
  assert.equal(r.labels[1], r.labels[2]);
  assert.equal(r.labels[3], r.labels[4]);
  assert.notEqual(r.labels[0], r.labels[3]);
});

test("DBSCAN marks isolated points as noise", () => {
  const rows = ROWS.concat([{ x: 100, y: 100 }]);
  const r = Clustering.dbscan(rows, KEYS, { eps: 1.5, minPts: 2, standardize: false });
  assert.equal(r.labels[6], -1);
  assert.equal(r.noise, 1);
});

test("hierarchical produces n-1 merges and cuts into k flat clusters", () => {
  const r = Clustering.hierarchical(ROWS, KEYS, { method: "average", standardize: false });
  assert.equal(r.merges.length, ROWS.length - 1);
  const labels = r.labelsAt(2);
  assert.equal(new Set(labels).size, 2);
  assert.equal(labels[0], labels[1]);
  assert.equal(labels[1], labels[2]);
  assert.notEqual(labels[0], labels[3]);
});

test("hierarchical single vs complete both separate the two blobs at k=2", () => {
  for (const method of ["single", "complete", "ward"]) {
    const r = Clustering.hierarchical(ROWS, KEYS, { method, standardize: false });
    const labels = r.labelsAt(2);
    assert.equal(new Set(labels).size, 2, method);
    assert.notEqual(labels[0], labels[3], method);
  }
});
