"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const DecisionTree = require("../js/decisionTree.js");

// ---------------------------------------------------------------------------
// Build a separable 2D dataset: cluster A around (0,0) label "A",
// cluster B around (10,10) label "B".
function separableRows() {
  const rows = [];
  const A = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]];
  const B = [[10, 10], [11, 10], [10, 11], [11, 11], [10.5, 10.5]];
  A.forEach(([x, y]) => rows.push({ x, y, label: "A" }));
  B.forEach(([x, y]) => rows.push({ x, y, label: "B" }));
  return rows;
}

// ---------------------------------------------------------------------------

test("separable data → 100% training accuracy", () => {
  const rows = separableRows();
  const model = DecisionTree.fit(rows, ["x", "y"], "label", { maxDepth: 6 });
  let correct = 0;
  for (const r of rows) {
    if (model.predict(r) === r.label) correct++;
  }
  assert.equal(correct, rows.length, "every training row classified correctly");
});

test("clearly-separable held-out point predicts right class", () => {
  const rows = separableRows();
  const model = DecisionTree.fit(rows, ["x", "y"], "label");
  assert.equal(model.predict({ x: 0.2, y: 0.3 }), "A");
  assert.equal(model.predict({ x: 10.2, y: 9.8 }), "B");
});

test("maxDepth=1 stump returns a valid tree and predicts", () => {
  const rows = separableRows();
  const model = DecisionTree.fit(rows, ["x", "y"], "label", { maxDepth: 1 });
  assert.ok(model.root, "root exists");
  assert.ok(model.depth <= 1, `depth=${model.depth} <= 1`);
  assert.ok(model.nNodes >= 1);
  // stump on separable data still splits the two clusters perfectly
  assert.equal(model.predict({ x: 0, y: 0 }), "A");
  assert.equal(model.predict({ x: 10, y: 10 }), "B");
});

test("predictTree standalone works with root + featKeys", () => {
  const rows = separableRows();
  const model = DecisionTree.fit(rows, ["x", "y"], "label");
  const p = DecisionTree.predictTree(model.root, { x: 11, y: 11 }, model.featKeys);
  assert.equal(p, "B");
  // exported alias `predict`
  const p2 = DecisionTree.predict(model.root, { x: 0, y: 0 }, model.featKeys);
  assert.equal(p2, "A");
});

test("classes are sorted and complete", () => {
  const rows = [
    { x: 0, t: "gamma" },
    { x: 1, t: "alpha" },
    { x: 2, t: "beta" },
    { x: 3, t: "alpha" },
    { x: 4, t: "gamma" },
    { x: 5, t: "beta" }
  ];
  const model = DecisionTree.fit(rows, ["x"], "t", { maxDepth: 4 });
  assert.deepEqual(model.classes, ["alpha", "beta", "gamma"]);
});

test("leaf stores class + normalized distribution", () => {
  const rows = separableRows();
  const model = DecisionTree.fit(rows, ["x", "y"], "label");
  // walk to a leaf
  let node = model.root;
  while (node && !node.leaf) node = node.left;
  assert.ok(node.leaf);
  assert.ok(typeof node.class === "string");
  const sum = model.classes.reduce((s, c) => s + node.dist[c], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `dist sums to 1 (got ${sum})`);
});

test("throws when fewer than 1 feature", () => {
  const rows = separableRows();
  assert.throws(() => DecisionTree.fit(rows, [], "label"), /feature/);
});

test("throws when target has < 2 classes", () => {
  const rows = [
    { x: 0, t: "only" },
    { x: 1, t: "only" },
    { x: 2, t: "only" }
  ];
  assert.throws(() => DecisionTree.fit(rows, ["x"], "t"), /2 classes/);
});

test("throws when fewer than 2 complete rows", () => {
  const rows = [
    { x: 0, t: "A" },
    { x: null, t: "B" },      // dropped: missing feature
    { x: 2, t: "" }           // dropped: missing target
  ];
  assert.throws(() => DecisionTree.fit(rows, ["x"], "t"), /2 complete rows/);
});

test("constant feature column is never chosen (no crash)", () => {
  const rows = [
    { x: 5, y: 0, t: "A" },
    { x: 5, y: 1, t: "A" },
    { x: 5, y: 10, t: "B" },
    { x: 5, y: 11, t: "B" }
  ];
  const model = DecisionTree.fit(rows, ["x", "y"], "t", { maxDepth: 4 });
  // must split on y (feature index 1), never the constant x
  assert.equal(model.root.feature, 1);
  assert.equal(model.predict({ x: 5, y: 0 }), "A");
  assert.equal(model.predict({ x: 5, y: 10 }), "B");
});

test("skips rows with non-finite features during fit", () => {
  const rows = separableRows().concat([
    { x: NaN, y: 0, label: "A" },
    { x: "abc", y: 5, label: "B" },
    { x: Infinity, y: 1, label: "A" }
  ]);
  const model = DecisionTree.fit(rows, ["x", "y"], "label");
  // still perfectly separable on the clean rows
  assert.equal(model.predict({ x: 0, y: 0 }), "A");
  assert.equal(model.predict({ x: 10, y: 10 }), "B");
});
