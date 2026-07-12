/* insight Analytics — pure CART classification-tree engine (window.DecisionTree)
   Binary CART on numeric features using gini impurity. Deterministic
   (no Math.random / Date.now). Rows are arrays of objects; feature values
   numeric; target is a categorical column (string/number label). */
(function () {
  "use strict";

  // ---- helpers -------------------------------------------------------------

  function isMissing(v) {
    return v === null || v === undefined || v === "";
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

  // extract valid rows: numeric feature vector + string target label.
  // drops rows with any missing/non-finite feature or missing target.
  function extract(rows, featKeys, targetKey) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var xs = [];
      var ok = true;
      for (var j = 0; j < featKeys.length; j++) {
        var raw = r[featKeys[j]];
        if (isMissing(raw)) { ok = false; break; }
        var num = Number(raw);
        if (!isFinite(num)) { ok = false; break; }
        xs.push(num);
      }
      if (!ok) continue;
      if (isMissing(r[targetKey])) continue;
      out.push({ xs: xs, y: String(r[targetKey]) });
    }
    return out;
  }

  // gini impurity of a set given per-class counts and total.
  function gini(counts, total) {
    if (total <= 0) return 0;
    var s = 0;
    for (var k in counts) {
      var p = counts[k] / total;
      s += p * p;
    }
    return 1 - s;
  }

  // majority class + normalized distribution over `classes` for a subset.
  function summarize(subset, classes) {
    var counts = {};
    for (var c = 0; c < classes.length; c++) counts[classes[c]] = 0;
    for (var i = 0; i < subset.length; i++) counts[subset[i].y]++;
    var n = subset.length;
    var dist = {};
    var best = classes[0], bestN = -1;
    for (var j = 0; j < classes.length; j++) {
      var cls = classes[j];
      dist[cls] = n > 0 ? counts[cls] / n : 0;
      // ties resolved by classes order (already sorted) → deterministic
      if (counts[cls] > bestN) { bestN = counts[cls]; best = cls; }
    }
    return { cls: best, dist: dist, counts: counts, n: n };
  }

  // find the best (feature, threshold) split minimizing weighted child gini.
  // returns null when no split strictly improves impurity.
  function bestSplit(subset, nFeat, parentGini) {
    var n = subset.length;
    var best = null;
    for (var f = 0; f < nFeat; f++) {
      // sort unique values of this feature
      var vals = [];
      for (var i = 0; i < n; i++) vals.push(subset[i].xs[f]);
      vals.sort(function (a, b) { return a - b; });
      // candidate thresholds = midpoints of adjacent distinct values
      for (var v = 1; v < n; v++) {
        if (vals[v] === vals[v - 1]) continue; // constant/tied → skip
        var threshold = (vals[v] + vals[v - 1]) / 2;
        // partition
        var leftCounts = {}, rightCounts = {}, nl = 0, nr = 0;
        for (var r = 0; r < n; r++) {
          var row = subset[r];
          if (row.xs[f] <= threshold) {
            leftCounts[row.y] = (leftCounts[row.y] || 0) + 1; nl++;
          } else {
            rightCounts[row.y] = (rightCounts[row.y] || 0) + 1; nr++;
          }
        }
        if (nl === 0 || nr === 0) continue;
        var wg = (nl / n) * gini(leftCounts, nl) + (nr / n) * gini(rightCounts, nr);
        if (best === null || wg < best.wg - 1e-12) {
          best = { feature: f, threshold: threshold, wg: wg };
        }
      }
    }
    // require a strict improvement over the parent's impurity
    if (best === null || best.wg >= parentGini - 1e-12) return null;
    return best;
  }

  // recursively build a CART node.
  function build(subset, classes, nFeat, depth, maxDepth, minSamples) {
    var summary = summarize(subset, classes);
    var g = gini(summary.counts, summary.n);

    function leaf() {
      return { leaf: true, class: summary.cls, dist: summary.dist, n: summary.n };
    }

    // stopping: pure node, depth cap, too few samples
    if (g <= 1e-12) return leaf();
    if (depth >= maxDepth) return leaf();
    if (subset.length < minSamples) return leaf();

    var split = bestSplit(subset, nFeat, g);
    if (!split) return leaf();

    var left = [], right = [];
    for (var i = 0; i < subset.length; i++) {
      if (subset[i].xs[split.feature] <= split.threshold) left.push(subset[i]);
      else right.push(subset[i]);
    }
    if (left.length === 0 || right.length === 0) return leaf();

    return {
      feature: split.feature,
      threshold: split.threshold,
      left: build(left, classes, nFeat, depth + 1, maxDepth, minSamples),
      right: build(right, classes, nFeat, depth + 1, maxDepth, minSamples),
      n: subset.length
    };
  }

  // walk a node counting depth (edges) and total nodes.
  function measure(node) {
    if (!node) return { depth: 0, count: 0 };
    if (node.leaf) return { depth: 0, count: 1 };
    var l = measure(node.left), r = measure(node.right);
    return { depth: 1 + Math.max(l.depth, r.depth), count: 1 + l.count + r.count };
  }

  // ---- predict -------------------------------------------------------------

  // standalone predict for a given root — walks feature-INDEX nodes using the
  // supplied feature key ordering. `featKeys` maps a node.feature index → key.
  function predictTree(root, row, featKeys) {
    var node = root;
    while (node && !node.leaf) {
      var key = featKeys[node.feature];
      var v = Number(row[key]);
      node = (v <= node.threshold) ? node.left : node.right;
    }
    return node ? node.class : null;
  }

  // ---- fit -----------------------------------------------------------------

  function fit(rows, featKeys, targetKey, opts) {
    opts = opts || {};
    var maxDepth = opts.maxDepth != null ? opts.maxDepth : 6;
    var minSamples = opts.minSamples != null ? opts.minSamples : 2;

    if (!featKeys || featKeys.length < 1) {
      throw new Error("DecisionTree.fit: need at least 1 feature key");
    }

    var data = extract(rows, featKeys, targetKey);
    if (data.length < 2) {
      throw new Error("DecisionTree.fit: need at least 2 complete rows");
    }

    // sorted distinct target labels (as strings)
    var seen = {};
    var classes = [];
    for (var i = 0; i < data.length; i++) {
      if (!seen[data[i].y]) { seen[data[i].y] = true; classes.push(data[i].y); }
    }
    classes.sort(cmp);
    if (classes.length < 2) {
      throw new Error("DecisionTree.fit: target has < 2 classes, cannot classify");
    }

    var keys = featKeys.slice();
    var root = build(data, classes, keys.length, 0, maxDepth, minSamples);
    var m = measure(root);

    function predict(row) {
      return predictTree(root, row, keys);
    }

    return {
      root: root,
      classes: classes,
      featKeys: keys,
      targetKey: targetKey,
      predict: predict,
      depth: m.depth,
      nNodes: m.count
    };
  }

  // ---- export --------------------------------------------------------------

  var api = {
    fit: fit,
    predict: predictTree,   // alias: predict(root, row, featKeys)
    predictTree: predictTree,
    _gini: gini
  };

  if (typeof window !== "undefined") window.DecisionTree = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
