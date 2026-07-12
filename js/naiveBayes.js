/*
 * naiveBayes.js — pure-JS Gaussian Naive Bayes classifier.
 * No-build, browser-first. Pure & deterministic (no Date.now / Math.random).
 * Exposes window.NaiveBayes (and module.exports under Node).
 *
 * Dual-mode engine: fit() returns a plain model object that also carries
 * bound predict/proba closures, plus standalone predictOne/probaOne that
 * work off the raw model (so callers can predict without the closure).
 */
(function () {
  "use strict";

  var VAR_EPS = 1e-9; // variance floor: prevents divide-by-zero on constant features
  var LN2PI = Math.log(2 * Math.PI);

  // ---- helpers -------------------------------------------------------------

  function isMissing(v) {
    return v === null || v === undefined || v === "";
  }

  // deterministic comparator for class labels: numbers/numeric-strings
  // numerically, booleans as 0/1, otherwise lexicographic.
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

  // Extract valid rows: every feature finite-numeric, target present.
  // Returns [{ xs:[numbers], y:String(label) }].
  function extract(rows, featKeys, targetKey) {
    var out = [];
    if (!rows) return out;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      if (isMissing(r[targetKey])) continue;
      var xs = [];
      var ok = true;
      for (var j = 0; j < featKeys.length; j++) {
        var raw = r[featKeys[j]];
        if (isMissing(raw)) { ok = false; break; }
        var num = typeof raw === "number" ? raw : Number(raw);
        if (!isFinite(num)) { ok = false; break; }
        xs.push(num);
      }
      if (!ok) continue;
      out.push({ xs: xs, y: String(r[targetKey]) });
    }
    return out;
  }

  // ---- fit -----------------------------------------------------------------

  function fit(rows, featKeys, targetKey) {
    if (!featKeys || featKeys.length < 1) {
      throw new Error("NaiveBayes.fit: need at least 1 feature key");
    }
    var nf = featKeys.length;
    var data = extract(rows, featKeys, targetKey);
    if (data.length < 2) {
      throw new Error("NaiveBayes.fit: need at least 2 complete rows, got " + data.length);
    }

    // group row indices by class label
    var groups = {};      // label -> array of xs
    var order = [];       // labels in first-seen order (before sort)
    for (var i = 0; i < data.length; i++) {
      var lbl = data[i].y;
      if (!Object.prototype.hasOwnProperty.call(groups, lbl)) {
        groups[lbl] = [];
        order.push(lbl);
      }
      groups[lbl].push(data[i].xs);
    }

    var classes = order.slice().sort(cmp);
    if (classes.length < 2) {
      throw new Error("NaiveBayes.fit: target has < 2 classes (got " + classes.length + ")");
    }

    var total = data.length;
    var priors = {};   // label -> prior probability
    var stats = {};    // label -> { mean:[], variance:[] }

    for (var c = 0; c < classes.length; c++) {
      var label = classes[c];
      var g = groups[label];
      var n = g.length;
      priors[label] = n / total;

      var mean = new Array(nf).fill(0);
      for (var k = 0; k < n; k++) {
        for (var f = 0; f < nf; f++) mean[f] += g[k][f];
      }
      for (f = 0; f < nf; f++) mean[f] /= n;

      // sample variance (ddof=1 when n>1, else 0), then floor to VAR_EPS
      var variance = new Array(nf).fill(0);
      for (k = 0; k < n; k++) {
        for (f = 0; f < nf; f++) {
          var d = g[k][f] - mean[f];
          variance[f] += d * d;
        }
      }
      var denom = n > 1 ? (n - 1) : 1;
      for (f = 0; f < nf; f++) {
        var v = variance[f] / denom;
        variance[f] = v > VAR_EPS ? v : VAR_EPS;
      }

      stats[label] = { mean: mean, variance: variance, count: n };
    }

    var model = {
      classes: classes,
      priors: priors,
      stats: stats,
      featKeys: featKeys.slice(),
      targetKey: targetKey,
      n: total
    };

    // bound closures for convenience
    model.proba = function (row) { return probaOne(model, row); };
    model.predict = function (row) { return predictOne(model, row); };

    return model;
  }

  // ---- prediction ----------------------------------------------------------

  // log of Gaussian pdf: -0.5*ln(2πσ²) - (x-μ)²/(2σ²)
  function logGaussian(x, mean, variance) {
    var d = x - mean;
    return -0.5 * (LN2PI + Math.log(variance)) - (d * d) / (2 * variance);
  }

  // Per-class log score (log prior + Σ log gaussian). Missing/non-finite
  // feature values are skipped (that feature contributes nothing).
  function classLogScores(model, row) {
    var featKeys = model.featKeys;
    var classes = model.classes;
    var scores = new Array(classes.length);
    for (var c = 0; c < classes.length; c++) {
      var label = classes[c];
      var st = model.stats[label];
      var s = Math.log(model.priors[label]);
      for (var j = 0; j < featKeys.length; j++) {
        var raw = row ? row[featKeys[j]] : undefined;
        if (isMissing(raw)) continue;
        var x = typeof raw === "number" ? raw : Number(raw);
        if (!isFinite(x)) continue;
        s += logGaussian(x, st.mean[j], st.variance[j]);
      }
      scores[c] = s;
    }
    return scores;
  }

  // normalized posterior probabilities via softmax over log scores.
  function probaOne(model, row) {
    var classes = model.classes;
    var logs = classLogScores(model, row);

    var maxLog = -Infinity;
    for (var c = 0; c < logs.length; c++) {
      if (logs[c] > maxLog) maxLog = logs[c];
    }

    var sum = 0;
    var exps = new Array(logs.length);
    for (c = 0; c < logs.length; c++) {
      var e = Math.exp(logs[c] - maxLog);
      exps[c] = e;
      sum += e;
    }

    var out = {};
    for (c = 0; c < classes.length; c++) {
      out[classes[c]] = sum > 0 ? exps[c] / sum : 1 / classes.length;
    }
    return out;
  }

  // argmax class (ties broken by class sort order, deterministic).
  function predictOne(model, row) {
    var classes = model.classes;
    var logs = classLogScores(model, row);
    var best = 0;
    for (var c = 1; c < logs.length; c++) {
      if (logs[c] > logs[best]) best = c;
    }
    return classes[best];
  }

  // ---- export --------------------------------------------------------------

  var api = {
    fit: fit,
    predictOne: predictOne,
    probaOne: probaOne,
    _logGaussian: logGaussian,
    VAR_EPS: VAR_EPS
  };

  if (typeof window !== "undefined") window.NaiveBayes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
