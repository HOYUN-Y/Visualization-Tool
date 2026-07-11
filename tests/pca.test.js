"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const PCA = require("../js/pca.js");

const close = (a, b, t = 1e-6) => assert.ok(Math.abs(a - b) <= t, `${a} !~= ${b} (tol ${t})`);

function makeRows(xs, keys) {
  return xs.map((v) => {
    const o = {};
    keys.forEach((k, i) => (o[k] = v[i]));
    return o;
  });
}

test("public API is present", () => {
  assert.equal(typeof PCA.fit, "function");
  assert.equal(typeof PCA.scree, "function");
  assert.equal(typeof PCA.biplot, "function");
});

test("perfectly correlated 2D data (y = 2x): PC1 ratio ~1, PC2 ~0", () => {
  const keys = ["x", "y"];
  const xs = [];
  for (let x = 1; x <= 10; x++) xs.push([x, 2 * x]);
  const rows = makeRows(xs, keys);
  const res = PCA.fit(rows, keys, { standardize: true });

  close(res.explainedRatio[0], 1, 1e-9);
  close(res.explainedRatio[1], 0, 1e-9);
  close(res.eigenvalues[1], 0, 1e-9);
});

test("explainedRatio sums to ~1", () => {
  const keys = ["a", "b", "c"];
  const rows = makeRows(
    [
      [1, 2, 0.5],
      [2, 1, 3.2],
      [3, 5, 1.1],
      [4, 3, 2.7],
      [5, 8, 0.9],
      [6, 6, 4.4]
    ],
    keys
  );
  const res = PCA.fit(rows, keys);
  const sum = res.explainedRatio.reduce((s, v) => s + v, 0);
  close(sum, 1, 1e-9);
});

test("eigenvalues sorted descending", () => {
  const keys = ["a", "b", "c"];
  const rows = makeRows(
    [
      [1, 2, 0.5],
      [2, 1, 3.2],
      [3, 5, 1.1],
      [4, 3, 2.7],
      [5, 8, 0.9],
      [6, 6, 4.4]
    ],
    keys
  );
  const res = PCA.fit(rows, keys);
  for (let k = 1; k < res.eigenvalues.length; k++) {
    assert.ok(res.eigenvalues[k - 1] >= res.eigenvalues[k] - 1e-12, "not descending");
  }
});

test("components are unit length", () => {
  const keys = ["a", "b", "c"];
  const rows = makeRows(
    [
      [1, 2, 0.5],
      [2, 1, 3.2],
      [3, 5, 1.1],
      [4, 3, 2.7],
      [5, 8, 0.9],
      [6, 6, 4.4]
    ],
    keys
  );
  const res = PCA.fit(rows, keys);
  res.components.forEach((comp) => {
    const ss = comp.reduce((s, v) => s + v * v, 0);
    close(ss, 1, 1e-9);
  });
});

test("3-var dataset: scores have zero column mean", () => {
  const keys = ["a", "b", "c"];
  const rows = makeRows(
    [
      [1, 2, 0.5],
      [2, 1, 3.2],
      [3, 5, 1.1],
      [4, 3, 2.7],
      [5, 8, 0.9],
      [6, 6, 4.4],
      [7, 4, 2.2]
    ],
    keys
  );
  const res = PCA.fit(rows, keys);
  const p = keys.length;
  for (let k = 0; k < p; k++) {
    let m = 0;
    for (let r = 0; r < res.n; r++) m += res.scores[r][k];
    m /= res.n;
    close(m, 0, 1e-9);
  }
});

test("rows with a missing value are dropped", () => {
  const keys = ["x", "y"];
  const rows = [
    { x: 1, y: 2 },
    { x: 2, y: null },
    { x: 3, y: "" },
    { x: 4, y: "nope" },
    { x: 5, y: 10 },
    { x: 6, y: 12 }
  ];
  const res = PCA.fit(rows, keys);
  assert.equal(res.n, 3); // only rows 1, 5, 6 are complete
});

test("guards: fewer than 2 keys throws", () => {
  assert.throws(() => PCA.fit([{ a: 1 }, { a: 2 }], ["a"]));
});

test("guards: fewer than 2 complete rows throws", () => {
  assert.throws(() => PCA.fit([{ a: 1, b: 2 }], ["a", "b"]));
  assert.throws(() =>
    PCA.fit([{ a: 1, b: 2 }, { a: null, b: 3 }], ["a", "b"])
  );
});

test("scree() returns cumulative reaching ~1", () => {
  const keys = ["a", "b", "c"];
  const rows = makeRows(
    [
      [1, 2, 0.5],
      [2, 1, 3.2],
      [3, 5, 1.1],
      [4, 3, 2.7],
      [5, 8, 0.9],
      [6, 6, 4.4]
    ],
    keys
  );
  const res = PCA.fit(rows, keys);
  const s = PCA.scree(res);
  assert.equal(s.length, 3);
  assert.equal(s[0].pc, 1);
  close(s[s.length - 1].cumulative, 1, 1e-9);
});

test("biplot() shapes and loading scaling", () => {
  const keys = ["a", "b", "c"];
  const rows = makeRows(
    [
      [1, 2, 0.5],
      [2, 1, 3.2],
      [3, 5, 1.1],
      [4, 3, 2.7],
      [5, 8, 0.9],
      [6, 6, 4.4]
    ],
    keys
  );
  const res = PCA.fit(rows, keys);
  const bp = PCA.biplot(res, 0, 1);
  assert.equal(bp.points.length, res.n);
  assert.equal(bp.points[0].length, 2);
  assert.equal(bp.loadings.length, keys.length);

  const si = Math.sqrt(res.eigenvalues[0]);
  close(bp.loadings[0].x, res.components[0][0] * si, 1e-12);
  assert.equal(bp.loadings[0].key, "a");
});
