(function () {
  "use strict";

  // ---- helpers -------------------------------------------------------------

  function sigmoid(z) {
    // numerically stable logistic
    if (z >= 0) {
      var e = Math.exp(-z);
      return 1 / (1 + e);
    }
    var ez = Math.exp(z);
    return ez / (1 + ez);
  }

  // deterministic comparator: numbers/numeric-strings numerically,
  // booleans as 0/1, otherwise lexicographic.
  function cmp(a, b) {
    var av = a, bv = b;
    if (typeof av === "boolean") av = av ? 1 : 0;
    if (typeof bv === "boolean") bv = bv ? 1 : 0;
    var na = Number(av), nb = Number(bv);
    if (isFinite(na) && isFinite(nb) && av !== "" && bv !== "") {
      return na - nb;
    }
    var sa = String(a), sb = String(b);
    return sa < sb ? -1 : (sa > sb ? 1 : 0);
  }

  // decide [neg, pos] classes from observed labels.
  // "the one that sorts later (or equals 1/true) becomes the positive class"
  function pickClasses(labels) {
    var uniq = [];
    for (var i = 0; i < labels.length; i++) {
      var v = labels[i];
      var seen = false;
      for (var k = 0; k < uniq.length; k++) {
        if (uniq[k] === v) { seen = true; break; }
      }
      if (!seen) uniq.push(v);
    }
    uniq.sort(cmp);
    if (uniq.length === 0) return [0, 1];
    if (uniq.length === 1) return [uniq[0], uniq[0]];
    var neg = uniq[0];
    var pos = uniq[uniq.length - 1];
    return [neg, pos];
  }

  function isMissing(v) {
    return v === null || v === undefined || v === "";
  }

  // extract valid (xs, rawLabel) rows, dropping any with missing/non-numeric fields
  function extract(rows, xKeys, yKey) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var xs = [];
      var ok = true;
      for (var j = 0; j < xKeys.length; j++) {
        var raw = r[xKeys[j]];
        if (isMissing(raw)) { ok = false; break; }
        var num = Number(raw);
        if (!isFinite(num)) { ok = false; break; }
        xs.push(num);
      }
      if (!ok) continue;
      if (isMissing(r[yKey])) continue;
      out.push({ xs: xs, y: r[yKey] });
    }
    return out;
  }

  // ---- fit -----------------------------------------------------------------

  function fit(rows, xKeys, yKey, options) {
    options = options || {};
    var iterations = options.iterations != null ? options.iterations : 200;
    var lr = options.lr != null ? options.lr : 0.1;
    var l2 = options.l2 != null ? options.l2 : 0;
    var standardize = options.standardize !== false;

    var nf = xKeys.length;
    var data = extract(rows, xKeys, yKey);
    var m = data.length;

    var classes = pickClasses(data.map(function (o) { return o.y; }));
    var pos = classes[1];

    // build standardized design matrix + binary targets
    var mean = new Array(nf).fill(0);
    var std = new Array(nf).fill(1);

    if (standardize && m > 0) {
      for (var i = 0; i < m; i++) {
        for (var j = 0; j < nf; j++) mean[j] += data[i].xs[j];
      }
      for (j = 0; j < nf; j++) mean[j] /= m;
      var varr = new Array(nf).fill(0);
      for (i = 0; i < m; i++) {
        for (j = 0; j < nf; j++) {
          var d = data[i].xs[j] - mean[j];
          varr[j] += d * d;
        }
      }
      for (j = 0; j < nf; j++) {
        var s = Math.sqrt(varr[j] / m);
        std[j] = s > 0 ? s : 1;
      }
    }

    var X = new Array(m);
    var Y = new Array(m);
    for (i = 0; i < m; i++) {
      var row = new Array(nf);
      for (j = 0; j < nf; j++) row[j] = (data[i].xs[j] - mean[j]) / std[j];
      X[i] = row;
      Y[i] = (data[i].y === pos) ? 1 : 0;
    }

    // batch gradient descent on mean log-loss (+ L2 ridge on weights only)
    //
    // CONVERGENCE IS NOW REPORTED, NOT ASSUMED (PLAN §12 E5). This was a fixed 200-iteration loop whose
    // comment claimed "converged weights" — untrue. On well-separated classes the MLE diverges (weights
    // grow without bound), so at iteration 200 the fit is wherever GD happened to stop: the coefficient
    // bar chart (mlMode.jsx:170) then reflects the iteration count, not the data, and predicted
    // probabilities are systematically under-confident. Accuracy/AUC (rank-based) are unaffected — so
    // this is a "the numbers you read off the bars/probabilities may be premature" problem, and the
    // honest fix is to tell the caller. We stop early when the gradient is flat (a real optimum, which
    // is also cheaper), and flag `converged` = did we stop before exhausting the iteration budget.
    var w = new Array(nf).fill(0);
    var b = 0;
    var eps = 1e-12;
    var GRAD_TOL = 1e-6; // ‖mean gradient‖∞ below this ⇒ at an optimum
    var converged = false;
    var itUsed = 0;

    for (var it = 0; it < iterations; it++) {
      var gw = new Array(nf).fill(0);
      var gb = 0;
      for (i = 0; i < m; i++) {
        var z = b;
        for (j = 0; j < nf; j++) z += w[j] * X[i][j];
        var p = sigmoid(z);
        var err = p - Y[i];
        for (j = 0; j < nf; j++) gw[j] += err * X[i][j];
        gb += err;
      }
      itUsed = it + 1;
      if (m > 0) {
        // max-norm of the mean gradient (incl. the L2 term on weights) — the quantity GD drives to 0.
        var gmax = Math.abs(gb / m);
        for (j = 0; j < nf; j++) { var g = gw[j] / m + l2 * w[j]; if (Math.abs(g) > gmax) gmax = Math.abs(g); }
        for (j = 0; j < nf; j++) {
          w[j] -= lr * (gw[j] / m + l2 * w[j]);
        }
        b -= lr * (gb / m);
        if (gmax < GRAD_TOL) { converged = true; break; }
      } else { break; }
    }

    // final mean log-loss
    var finalLoss = 0;
    for (i = 0; i < m; i++) {
      var zz = b;
      for (j = 0; j < nf; j++) zz += w[j] * X[i][j];
      var pp = sigmoid(zz);
      finalLoss += -(Y[i] * Math.log(pp + eps) + (1 - Y[i]) * Math.log(1 - pp + eps));
    }
    finalLoss = m > 0 ? finalLoss / m : 0;

    return {
      xKeys: xKeys.slice(),
      yKey: yKey,
      classes: classes,
      mean: mean,
      std: std,
      weights: w,
      bias: b,
      iterations: iterations,    // the budget that was requested
      iterationsUsed: itUsed,    // how many were actually run (< budget ⇒ stopped at an optimum)
      converged: converged,      // false ⇒ hit the budget still moving; coefficients/probabilities are premature
      finalLoss: finalLoss
    };
  }

  // ---- prediction ----------------------------------------------------------

  function predictProba(model, row) {
    var z = model.bias;
    for (var j = 0; j < model.xKeys.length; j++) {
      var v = Number(row[model.xKeys[j]]);
      var xs = (v - model.mean[j]) / model.std[j];
      z += model.weights[j] * xs;
    }
    return sigmoid(z);
  }

  function predict(model, row, threshold) {
    if (threshold == null) threshold = 0.5;
    return predictProba(model, row) >= threshold ? 1 : 0;
  }

  // ---- ROC / AUC -----------------------------------------------------------

  function roc(yTrue, yScore) {
    var n = yTrue.length;
    var P = 0, N = 0;
    for (var t = 0; t < n; t++) {
      if (yTrue[t] === 1) P++; else N++;
    }

    var idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return yScore[b] - yScore[a]; });

    var points = [{ fpr: 0, tpr: 0, threshold: Infinity }];
    var tp = 0, fp = 0;
    i = 0;
    while (i < n) {
      var sc = yScore[idx[i]];
      while (i < n && yScore[idx[i]] === sc) {
        if (yTrue[idx[i]] === 1) tp++; else fp++;
        i++;
      }
      points.push({
        fpr: N ? fp / N : 0,
        tpr: P ? tp / P : 0,
        threshold: sc
      });
    }

    // guarantee endpoint at (1,1)
    var last = points[points.length - 1];
    if (last.fpr !== 1 || last.tpr !== 1) {
      points.push({ fpr: 1, tpr: 1, threshold: -Infinity });
    }

    // trapezoidal AUC over the ROC curve
    var auc = 0;
    for (var k = 1; k < points.length; k++) {
      var dx = points[k].fpr - points[k - 1].fpr;
      var my = (points[k].tpr + points[k - 1].tpr) / 2;
      auc += dx * my;
    }

    return { points: points, auc: auc };
  }

  // ---- Precision-Recall / AP ----------------------------------------------

  function prCurve(yTrue, yScore) {
    var n = yTrue.length;
    var P = 0;
    for (var t = 0; t < n; t++) if (yTrue[t] === 1) P++;

    var idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return yScore[b] - yScore[a]; });

    var points = [{ recall: 0, precision: 1, threshold: Infinity }];
    var tp = 0, fp = 0;
    var ap = 0;
    var prevRecall = 0;
    i = 0;
    while (i < n) {
      var sc = yScore[idx[i]];
      while (i < n && yScore[idx[i]] === sc) {
        if (yTrue[idx[i]] === 1) tp++; else fp++;
        i++;
      }
      var recall = P ? tp / P : 0;
      var precision = (tp + fp) ? tp / (tp + fp) : 1;
      points.push({ recall: recall, precision: precision, threshold: sc });
      ap += (recall - prevRecall) * precision;
      prevRecall = recall;
    }

    return { points: points, ap: ap };
  }

  // ---- classification metrics ---------------------------------------------

  function metrics(yTrue, yPred) {
    var tp = 0, fp = 0, tn = 0, fn = 0;
    for (var i = 0; i < yTrue.length; i++) {
      var t = yTrue[i] === 1 ? 1 : 0;
      var p = yPred[i] === 1 ? 1 : 0;
      if (t === 1 && p === 1) tp++;
      else if (t === 0 && p === 1) fp++;
      else if (t === 0 && p === 0) tn++;
      else fn++;
    }
    var total = tp + fp + tn + fn;
    var accuracy = total ? (tp + tn) / total : 0;
    var precision = (tp + fp) ? tp / (tp + fp) : 0;
    var recall = (tp + fn) ? tp / (tp + fn) : 0;
    var f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
    return {
      accuracy: accuracy,
      precision: precision,
      recall: recall,
      f1: f1,
      tp: tp, fp: fp, tn: tn, fn: fn
    };
  }

  // ---- export --------------------------------------------------------------

  var api = {
    fit: fit,
    predictProba: predictProba,
    predict: predict,
    roc: roc,
    prCurve: prCurve,
    metrics: metrics,
    _sigmoid: sigmoid
  };

  if (typeof window !== "undefined") window.Logistic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
