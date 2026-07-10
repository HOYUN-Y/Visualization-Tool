"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Logistic = require("../js/logistic.js");

// ---------------------------------------------------------------------------

test("classic ROC example → AUC = 0.75", () => {
  const r = Logistic.roc([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8]);
  assert.ok(Math.abs(r.auc - 0.75) < 1e-9, `auc=${r.auc}`);
});

test("ROC starts at (0,0), ends at (1,1), is monotonic", () => {
  const r = Logistic.roc([0, 1, 0, 1, 1, 0], [0.2, 0.9, 0.4, 0.6, 0.55, 0.1]);
  const pts = r.points;
  assert.deepEqual(
    { fpr: pts[0].fpr, tpr: pts[0].tpr },
    { fpr: 0, tpr: 0 }
  );
  const last = pts[pts.length - 1];
  assert.deepEqual({ fpr: last.fpr, tpr: last.tpr }, { fpr: 1, tpr: 1 });
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i].fpr >= pts[i - 1].fpr - 1e-12, "fpr non-decreasing");
    assert.ok(pts[i].tpr >= pts[i - 1].tpr - 1e-12, "tpr non-decreasing");
  }
  assert.ok(r.auc >= 0 && r.auc <= 1);
});

test("metrics on a known confusion matrix are exact", () => {
  // yTrue vs yPred designed to give tp=3, fp=1, tn=2, fn=1
  const yTrue = [1, 1, 1, 1, 0, 0, 0];
  const yPred = [1, 1, 1, 0, 1, 0, 0];
  const m = Logistic.metrics(yTrue, yPred);
  assert.equal(m.tp, 3);
  assert.equal(m.fp, 1);
  assert.equal(m.tn, 2);
  assert.equal(m.fn, 1);
  assert.ok(Math.abs(m.accuracy - 5 / 7) < 1e-12);
  assert.ok(Math.abs(m.precision - 3 / 4) < 1e-12);
  assert.ok(Math.abs(m.recall - 3 / 4) < 1e-12);
  assert.ok(Math.abs(m.f1 - 0.75) < 1e-12);
});

test("linearly separable 1D data fits correctly", () => {
  const rows = [];
  for (let x = -6; x <= -1; x++) rows.push({ x: x, y: 0 });
  for (let x = 1; x <= 6; x++) rows.push({ x: x, y: 1 });

  const model = Logistic.fit(rows, ["x"], "y", { iterations: 500, lr: 0.5 });

  // weight sign positive (standardized space)
  assert.ok(model.weights[0] > 0, `weight=${model.weights[0]}`);
  assert.deepEqual(model.classes, [0, 1]);

  // predictProba increases with x
  const pLow = Logistic.predictProba(model, { x: -5 });
  const pMid = Logistic.predictProba(model, { x: 0 });
  const pHigh = Logistic.predictProba(model, { x: 5 });
  assert.ok(pLow < pMid && pMid < pHigh, `${pLow} ${pMid} ${pHigh}`);

  // AUC on training ≈ 1.0
  const yTrue = rows.map((r) => r.y);
  const yScore = rows.map((r) => Logistic.predictProba(model, r));
  const roc = Logistic.roc(yTrue, yScore);
  assert.ok(roc.auc > 0.99, `auc=${roc.auc}`);

  // predict thresholds
  assert.equal(Logistic.predict(model, { x: 5 }), 1);
  assert.equal(Logistic.predict(model, { x: -5 }), 0);
});

test("label mapping: 'no'/'yes' behave like 0/1", () => {
  const rows = [];
  for (let x = -6; x <= -1; x++) rows.push({ x: x, y: "no" });
  for (let x = 1; x <= 6; x++) rows.push({ x: x, y: "yes" });

  const model = Logistic.fit(rows, ["x"], "y", { iterations: 500, lr: 0.5 });
  assert.deepEqual(model.classes, ["no", "yes"]); // "yes" sorts later → positive
  assert.ok(model.weights[0] > 0);

  // high x → positive class ("yes") → predict 1, high prob
  assert.ok(Logistic.predictProba(model, { x: 5 }) > 0.9);
  assert.ok(Logistic.predictProba(model, { x: -5 }) < 0.1);
  assert.equal(Logistic.predict(model, { x: 5 }), 1);
});

test("PR curve returns a sane AP in [0,1]", () => {
  const pr = Logistic.prCurve([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8]);
  assert.ok(pr.ap >= 0 && pr.ap <= 1, `ap=${pr.ap}`);
  assert.ok(pr.points.length >= 2);
});

test("rows with missing feature/target values are dropped", () => {
  const rows = [
    { x: 1, y: 1 },
    { x: null, y: 1 },
    { x: 2, y: "" },
    { x: "nan", y: 0 },
    { x: -1, y: 0 }
  ];
  // should not throw; effectively fits on 2 valid rows
  const model = Logistic.fit(rows, ["x"], "y", { iterations: 50 });
  assert.equal(model.xKeys.length, 1);
  assert.ok(isFinite(model.bias));
  assert.ok(isFinite(model.finalLoss));
});
