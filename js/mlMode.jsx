/* NØDE/Insight — ML Studio (JMP-enhanced): regression, k-NN, KMeans + model comparison */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const EChart = Charts.EChart;
  const IE = window.IE;
  // Config helpers (schema-agnostic starter/heal) extracted to js/mlCfg.js for Node regression tests.
  const { mlNums, mlCats, mlDefaultCfg, mlResolveCfg, mlEligibility } = window.MlCfg;

  // ---- math ----
  function seededShuffle(n, seed) {
    let s = seed; const idx = [...Array(n).keys()];
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx;
  }
  function solve(A, b) {
    const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      if (Math.abs(M[c][c]) < 1e-9) M[c][c] = 1e-9;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / M[i][i]);
  }
  const _mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const _std = (a) => { const m = _mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1; };

  // ---- models ----
  function regression(rows, target, feats, split) {
    const data = rows.filter((r) => feats.every((f) => r[f] != null) && r[target] != null);
    const idx = seededShuffle(data.length, 7); const cut = Math.floor(data.length * (1 - split));
    const tr = idx.slice(0, cut).map((i) => data[i]), te = idx.slice(cut).map((i) => data[i]);
    const X = tr.map((r) => [1, ...feats.map((f) => r[f])]); const y = tr.map((r) => r[target]);
    const p = feats.length + 1; const A = Array.from({ length: p }, () => Array(p).fill(0)); const Bv = Array(p).fill(0);
    for (let i = 0; i < X.length; i++) { for (let a = 0; a < p; a++) { Bv[a] += X[i][a] * y[i]; for (let b = 0; b < p; b++) A[a][b] += X[i][a] * X[i][b]; } }
    const coef = solve(A, Bv);
    const pred = (r) => coef[0] + feats.reduce((s, f, i) => s + coef[i + 1] * r[f], 0);
    const yt = te.map((r) => r[target]), yp = te.map(pred);
    const ym = _mean(yt), ssTot = yt.reduce((s, v) => s + (v - ym) ** 2, 0);
    const ssRes = yt.reduce((s, v, i) => s + (v - yp[i]) ** 2, 0);
    const r2 = 1 - ssRes / ssTot, rmse = Math.sqrt(ssRes / te.length);
    const mae = te.reduce((s, _, i) => s + Math.abs(yt[i] - yp[i]), 0) / te.length;
    const sy = _std(y);
    const importance = feats.map((f, i) => ({ f, coef: coef[i + 1], imp: Math.abs(coef[i + 1] * _std(tr.map((r) => r[f])) / sy) }))
      .sort((a, b) => b.imp - a.imp);
    // residuals for residual plot
    const residuals = te.map((r, i) => [yp[i], yt[i] - yp[i]]);
    return { kind: "reg", r2, rmse, mae, importance, scatter: te.map((r, i) => [yt[i], yp[i]]), residuals, nTrain: tr.length, nTest: te.length, target };
  }

  function classification(rows, target, feats, split, k) {
    const data = rows.filter((r) => feats.every((f) => r[f] != null) && r[target] != null);
    const stats = feats.map((f) => [_mean(data.map((r) => r[f])), _std(data.map((r) => r[f]))]);
    const z = (r) => feats.map((f, i) => (r[f] - stats[i][0]) / stats[i][1]);
    const idx = seededShuffle(data.length, 11); const cut = Math.floor(data.length * (1 - split));
    const tr = idx.slice(0, cut).map((i) => data[i]), te = idx.slice(cut).map((i) => data[i]);
    const trZ = tr.map((r) => ({ z: z(r), c: r[target] }));
    const classes = [...new Set(data.map((r) => r[target]))];
    const cm = classes.map(() => classes.map(() => 0));
    let correct = 0;
    for (const r of te) {
      const zr = z(r);
      const nn = trZ.map((t) => ({ d: t.z.reduce((s, v, i) => s + (v - zr[i]) ** 2, 0), c: t.c })).sort((a, b) => a.d - b.d).slice(0, k);
      const vote = {}; for (const x of nn) vote[x.c] = (vote[x.c] || 0) + 1;
      const voteRanked = Object.entries(vote).sort((a, b) => b[1] - a[1]);
      if (!voteRanked.length) continue; // empty training set → no neighbors to vote
      const predClass = voteRanked[0][0];
      cm[classes.indexOf(r[target])][classes.indexOf(predClass)]++;
      if (predClass === r[target]) correct++;
    }
    // per-class precision, recall, F1
    const perClass = classes.map((cl, i) => {
      const tp = cm[i][i];
      const fp = cm.reduce((s, row, ri) => ri !== i ? s + row[i] : s, 0);
      const fn = cm[i].reduce((s, v, j) => j !== i ? s + v : s, 0);
      const prec = tp / (tp + fp) || 0, rec = tp / (tp + fn) || 0;
      const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
      return { cl, tp, fp, fn, prec, rec, f1 };
    });
    const macroF1 = perClass.reduce((s, p) => s + p.f1, 0) / classes.length;
    return { kind: "clf", acc: correct / te.length, classes, cm, perClass, macroF1, nTrain: tr.length, nTest: te.length, target, k };
  }

  // Shared classification metrics: confusion matrix + per-class precision/recall/F1 + macro-F1 + accuracy.
  // `predFn(row)` returns the predicted class label. Mirrors the cm/perClass/macroF1 logic in classification().
  function clfMetrics(classes, te, target, predFn) {
    const cm = classes.map(() => classes.map(() => 0));
    let correct = 0;
    for (const r of te) {
      const predClass = predFn(r);
      const ai = classes.indexOf(r[target]), pi = classes.indexOf(predClass);
      if (ai < 0 || pi < 0) continue; // unseen class → skip (defensive; keeps cm indexing safe)
      cm[ai][pi]++;
      if (predClass === r[target]) correct++;
    }
    const perClass = classes.map((cl, i) => {
      const tp = cm[i][i];
      const fp = cm.reduce((s, row, ri) => ri !== i ? s + row[i] : s, 0);
      const fn = cm[i].reduce((s, v, j) => j !== i ? s + v : s, 0);
      const prec = tp / (tp + fp) || 0, rec = tp / (tp + fn) || 0;
      const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
      return { cl, tp, fp, fn, prec, rec, f1 };
    });
    const macroF1 = perClass.reduce((s, p) => s + p.f1, 0) / classes.length;
    return { acc: correct / te.length, cm, perClass, macroF1 };
  }

  // ---- Decision Tree (window.DecisionTree) ----
  function dtModel(rows, target, feats, split) {
    const data = rows.filter((r) => feats.every((f) => r[f] != null) && r[target] != null);
    const idx = seededShuffle(data.length, 17); const cut = Math.floor(data.length * (1 - split));
    const tr = idx.slice(0, cut).map((i) => data[i]), te = idx.slice(cut).map((i) => data[i]);
    const model = window.DecisionTree.fit(tr, feats, target, { maxDepth: 6, minSamples: 2 });
    const classes = model.classes;
    const { acc, cm, perClass, macroF1 } = clfMetrics(classes, te, target, (r) => model.predict(r));
    return { kind: "dt", acc, cm, classes, perClass, macroF1, nTrain: tr.length, nTest: te.length, target, depth: model.depth, nNodes: model.nNodes };
  }

  // ---- Naive Bayes (window.NaiveBayes) ----
  function nbModel(rows, target, feats, split) {
    const data = rows.filter((r) => feats.every((f) => r[f] != null) && r[target] != null);
    const idx = seededShuffle(data.length, 19); const cut = Math.floor(data.length * (1 - split));
    const tr = idx.slice(0, cut).map((i) => data[i]), te = idx.slice(cut).map((i) => data[i]);
    const model = window.NaiveBayes.fit(tr, feats, target);
    const classes = model.classes;
    const { acc, cm, perClass, macroF1 } = clfMetrics(classes, te, target, (r) => model.predict(r));
    return { kind: "nb", acc, cm, classes, perClass, macroF1, nTrain: tr.length, nTest: te.length, target };
  }

  function kmeans(rows, feats, K) {
    const data = rows.filter((r) => feats.every((f) => r[f] != null));
    const stats = feats.map((f) => [_mean(data.map((r) => r[f])), _std(data.map((r) => r[f]))]);
    const pts = data.map((r) => feats.map((f, i) => (r[f] - stats[i][0]) / stats[i][1]));
    let cent = seededShuffle(pts.length, 5).slice(0, K).map((i) => [...pts[i]]);
    let assign = new Array(pts.length).fill(0);
    for (let it = 0; it < 18; it++) {
      assign = pts.map((p) => { let best = 0, bd = Infinity; for (let c = 0; c < K; c++) { const d = p.reduce((s, v, i) => s + (v - cent[c][i]) ** 2, 0); if (d < bd) { bd = d; best = c; } } return best; });
      cent = cent.map((_, c2) => { const m = pts.filter((_, i) => assign[i] === c2); if (!m.length) return cent[c2]; return feats.map((__, i) => _mean(m.map((p) => p[i]))); });
    }
    const inertia = pts.reduce((s, p, i) => s + p.reduce((a, v, j) => a + (v - cent[assign[i]][j]) ** 2, 0), 0);
    const sizes = cent.map((_, c2) => assign.filter((a) => a === c2).length);
    // cluster means in original (unstandardized) space
    const clusterMeans = cent.map((_, c2) => {
      const memberRows = data.filter((_, i) => assign[i] === c2);
      const means = {};
      feats.forEach((f) => { means[f] = _mean(memberRows.map((r) => r[f])); });
      return means;
    });
    const scatter = data.map((r, i) => ({ value: [r[feats[0]], r[feats[1] || feats[0]]], cluster: assign[i] }));
    return { kind: "km", K, inertia: Math.round(inertia), sizes, clusterMeans, scatter, feats, nTrain: data.length };
  }

  // ---- Logistic regression (window.Logistic) ----
  function logisticModel(rows, target, feats, split) {
    const data = rows.filter((r) => feats.every((f) => r[f] != null) && r[target] != null);
    const distinct = [...new Set(data.map((r) => r[target]))];
    if (distinct.length !== 2) throw new Error("Logistic needs a binary target (exactly 2 classes)");
    const idx = seededShuffle(data.length, 13); const cut = Math.floor(data.length * (1 - split));
    const tr = idx.slice(0, cut).map((i) => data[i]), te = idx.slice(cut).map((i) => data[i]);
    const model = window.Logistic.fit(tr, feats, target, { iterations: 400, lr: 0.3, standardize: true });
    const pos = model.classes[1];
    const scores = te.map((r) => window.Logistic.predictProba(model, r));
    const yt = te.map((r) => String(r[target]) === String(pos) ? 1 : 0);
    const roc = window.Logistic.roc(yt, scores);
    const pr = window.Logistic.prCurve ? window.Logistic.prCurve(yt, scores) : null;
    const preds = scores.map((s) => s >= 0.5 ? 1 : 0);
    const m = window.Logistic.metrics(yt, preds);
    const coefs = feats.map((f, i) => ({ f, w: model.weights[i] })).sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
    return { kind: "logit", classes: model.classes, roc, pr, coefs, feats, target, acc: m.accuracy, auc: roc.auc, ap: pr ? pr.ap : null, f1: m.f1, prec: m.precision, rec: m.recall, nTrain: tr.length, nTest: te.length, converged: model.converged };
  }

  // ---- k-fold Cross-Validation runner (window.CrossVal) ----
  // Returns { mean, std, folds, metric } or null if not applicable.
  // Uses engine-level fit/predict per fold (NOT the wrappers above, which do their
  // own hold-out split). CrossVal is seeded (1) → deterministic across runs.
  function runCV(task, data, feats, target, split, k) {
    if (!(k >= 2)) return null;
    if (!["reg", "clf", "logit", "dt", "nb"].includes(task)) return null;
    const cleanData = data.filter((r) => feats.every((f) => r[f] != null) && r[target] != null);
    if (cleanData.length < 2 * k) return null;

    let trainFn, scoreFn, metric;
    if (task === "reg") {
      metric = "R²";
      // Replicate the normal-equations OLS fit from regression().
      trainFn = (tr) => {
        const p = feats.length + 1;
        const A = Array.from({ length: p }, () => Array(p).fill(0)); const Bv = Array(p).fill(0);
        for (const r of tr) {
          const x = [1, ...feats.map((f) => r[f])]; const y = r[target];
          for (let a = 0; a < p; a++) { Bv[a] += x[a] * y; for (let b = 0; b < p; b++) A[a][b] += x[a] * x[b]; }
        }
        const coef = solve(A, Bv);
        return (r) => coef[0] + feats.reduce((s, f, i) => s + coef[i + 1] * r[f], 0);
      };
      scoreFn = (pred, te) => {
        const yt = te.map((r) => r[target]), yp = te.map(pred);
        const ym = _mean(yt), ssTot = yt.reduce((s, v) => s + (v - ym) ** 2, 0);
        if (ssTot === 0) return NaN;
        const ssRes = yt.reduce((s, v, i) => s + (v - yp[i]) ** 2, 0);
        return 1 - ssRes / ssTot;
      };
    } else if (task === "clf") {
      metric = "Accuracy";
      // Replicate classification()'s standardized k-NN majority vote.
      trainFn = (tr) => {
        const stats = feats.map((f) => [_mean(tr.map((r) => r[f])), _std(tr.map((r) => r[f]))]);
        const z = (r) => feats.map((f, i) => (r[f] - stats[i][0]) / stats[i][1]);
        const trZ = tr.map((r) => ({ z: z(r), c: r[target] }));
        return { trZ, z, stats, k };
      };
      scoreFn = (model, te) => {
        let correct = 0;
        for (const r of te) {
          const zr = model.z(r);
          const nn = model.trZ.map((t) => ({ d: t.z.reduce((s, v, i) => s + (v - zr[i]) ** 2, 0), c: t.c })).sort((a, b) => a.d - b.d).slice(0, model.k);
          const vote = {}; for (const x of nn) vote[x.c] = (vote[x.c] || 0) + 1;
          const ranked = Object.entries(vote).sort((a, b) => b[1] - a[1]);
          if (ranked.length && String(ranked[0][0]) === String(r[target])) correct++;
        }
        return correct / te.length;
      };
    } else if (task === "dt") {
      metric = "Accuracy";
      trainFn = (tr) => window.DecisionTree.fit(tr, feats, target, { maxDepth: 6, minSamples: 2 });
      scoreFn = (model, te) => { let correct = 0; for (const r of te) if (model.predict(r) === r[target]) correct++; return correct / te.length; };
    } else if (task === "nb") {
      metric = "Accuracy";
      trainFn = (tr) => window.NaiveBayes.fit(tr, feats, target);
      scoreFn = (model, te) => { let correct = 0; for (const r of te) if (model.predict(r) === r[target]) correct++; return correct / te.length; };
    } else { // logit
      const distinct = [...new Set(cleanData.map((r) => r[target]))];
      if (distinct.length !== 2) return null; // CV assumes a 2-class target
      metric = "Accuracy";
      trainFn = (tr) => window.Logistic.fit(tr, feats, target, { iterations: 400, lr: 0.3, standardize: true });
      scoreFn = (model, te) => {
        let correct = 0;
        for (const r of te) {
          const pred = window.Logistic.predictProba(model, r) >= 0.5 ? model.classes[1] : model.classes[0];
          if (String(pred) === String(r[target])) correct++;
        }
        return correct / te.length;
      };
    }

    const cv = window.CrossVal.crossValidate(cleanData, k, trainFn, scoreFn, 1);
    return { mean: cv.mean, std: cv.std, folds: cv.folds, metric };
  }

  // ---- PCA (window.PCA) ----
  function pcaModel(rows, feats) {
    if (feats.length < 2) throw new Error("PCA needs at least 2 features");
    const res = window.PCA.fit(rows, feats, { standardize: true });
    const scree = window.PCA.scree(res);
    const biplot = window.PCA.biplot(res, 0, 1);
    return { kind: "pca", feats, scree, biplot, explainedRatio: res.explainedRatio, pc1: res.explainedRatio[0], pc2: res.explainedRatio[1] || 0, nTrain: res.n };
  }

  // ---- DBSCAN (window.Clustering) ----
  function dbscanModel(rows, feats, eps, minPts) {
    const res = window.Clustering.dbscan(rows, feats, { eps, minPts, standardize: true });
    const k0 = feats[0], k1 = feats[1] || feats[0];
    const scatter = res.sourceIndex.map((si, i) => ({ value: [rows[si][k0], rows[si][k1]], cluster: res.labels[i] }));
    return { kind: "dbscan", feats, clusters: res.clusters, noise: res.noise, eps, minPts, scatter, nTrain: res.sourceIndex.length };
  }

  // ---- Hierarchical clustering (window.Clustering) ----
  function hierModel(rows, feats, K) {
    const res = window.Clustering.hierarchical(rows, feats, { method: "ward", standardize: true });
    const labels = res.labelsAt(K);
    const k0 = feats[0], k1 = feats[1] || feats[0];
    const scatter = res.sourceIndex.map((si, i) => ({ value: [rows[si][k0], rows[si][k1]], cluster: labels[i] }));
    const merges = res.merges.map((m, i) => [i + 1, m.dist]);
    return { kind: "hier", feats, K, scatter, merges, method: "ward", nTrain: res.n };
  }

  // ---- model history (stored on NODE so it persists across re-renders) ----
  if (!window.NODE.mlHistory) window.NODE.mlHistory = [];

  function pushHistory(entry) {
    const hist = window.NODE.mlHistory;
    hist.push(entry);
    if (hist.length > 10) hist.shift();
    window.NODE.lastAnalysisResult = { type: "ml", ...entry };
    if (window.ProjectStore) window.ProjectStore.markDirty();
  }

  // ---- center components ----
  function MLCenter() {
    const cfg = useStore((s) => s.ui.ml) || {};
    const theme = useStore((s) => s.theme);
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const res = cfg.result;
    const hist = window.NODE.mlHistory || [];

    if (!res) return (
      <React.Fragment>
        <div className="phead"><span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
          <Icon name="ml" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />{T("mlStudio")}</span></div>
        <div className="empty"><Icon name="ml" /><div className="t">{T("mlEmptyTitle")}</div><div className="s">{T("mlEmptyDesc")}</div></div>
        {hist.length > 0 && <ModelHistory hist={hist} />}
      </React.Fragment>
    );

    const c = Charts.themeColors(), pal = Charts.palette();
    const summary = IE && (res.kind === "reg" || ["clf", "dt", "nb"].includes(res.kind) || res.kind === "km") ? (
      res.kind === "reg" ? IE.summarizeRegression({ r2: res.r2, adj: 1 - (1 - res.r2) * res.nTrain / (res.nTrain - 2), terms: [], target: res.target, pF: 0 }) :
      ["clf", "dt", "nb"].includes(res.kind) ? IE.summarizeClassification(res) :
      IE.summarizeClustering(res)
    ) : "";

    let option, metrics;
    if (res.kind === "reg") {
      const _flat = res.scatter.flat();
      const lo = _flat.length ? Math.min(..._flat) : 0, hi = _flat.length ? Math.max(..._flat) : 1;
      option = { ...Charts.baseGrid(c), grid: { left: 8, right: 16, top: 16, bottom: 30, containLabel: true },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item", formatter: (p) => `actual ${NODE.fmtCompact(p.value[0])}<br/>pred ${NODE.fmtCompact(p.value[1])}` },
        xAxis: { type: "value", name: "actual", min: lo, max: hi, axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        yAxis: { type: "value", name: "predicted", min: lo, max: hi, axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        series: [{ type: "scatter", symbolSize: 6, data: res.scatter, itemStyle: { color: pal[0], opacity: 0.6 },
          markLine: { silent: true, symbol: "none", lineStyle: { color: c.faint, type: "dashed" }, data: [[{ coord: [lo, lo] }, { coord: [hi, hi] }]] } }] };
      metrics = [["R²", res.r2.toFixed(3)], ["RMSE", NODE.fmtCompact(res.rmse)], ["MAE", NODE.fmtCompact(res.mae)], ["Test n", res.nTest]];
    } else if (["clf", "dt", "nb"].includes(res.kind)) {
      const data = []; res.cm.forEach((row, i) => row.forEach((v, j) => data.push([j, i, v])));
      const maxV = Math.max(...res.cm.flat(), 1);
      option = { grid: { left: 8, right: 60, top: 10, bottom: 60, containLabel: true },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item", formatter: (p) => `actual <b>${res.classes[p.value[1]]}</b><br/>pred <b>${res.classes[p.value[0]]}</b>: ${p.value[2]}` },
        xAxis: { type: "category", data: res.classes, name: "predicted", axisLabel: { color: c.text, fontSize: 10, rotate: 20 }, splitArea: { show: true } },
        yAxis: { type: "category", data: res.classes, name: "actual", axisLabel: { color: c.text, fontSize: 10 } },
        visualMap: { min: 0, max: maxV, calculable: true, right: 6, bottom: 30, inRange: { color: [c.bg, pal[0]] }, textStyle: { color: c.text, fontSize: 10 } },
        series: [{ type: "heatmap", data, label: { show: true, color: c.textHi, fontFamily: "IBM Plex Mono" } }] };
      metrics = [["Accuracy", (res.acc * 100).toFixed(1) + "%"], ["Macro F1", res.macroF1 ? res.macroF1.toFixed(3) : "—"], ["Classes", res.classes.length], ["Test n", res.nTest]];
    } else if (res.kind === "logit") {
      option = { ...Charts.baseGrid(c), grid: { left: 8, right: 16, top: 16, bottom: 34, containLabel: true },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item", formatter: (p) => `FPR ${(+p.value[0]).toFixed(2)}<br/>TPR ${(+p.value[1]).toFixed(2)}` },
        xAxis: { type: "value", name: "FPR", min: 0, max: 1, axisLabel: { color: c.text, fontSize: 10 }, splitLine: { lineStyle: { color: c.split } } },
        yAxis: { type: "value", name: "TPR", min: 0, max: 1, axisLabel: { color: c.text, fontSize: 10 }, splitLine: { lineStyle: { color: c.split } } },
        series: [
          { type: "line", data: res.roc.points.map((p) => [p.fpr, p.tpr]), showSymbol: false, smooth: false, lineStyle: { color: pal[0], width: 2 }, areaStyle: { color: pal[0], opacity: 0.12 } },
          { type: "line", data: [[0, 0], [1, 1]], showSymbol: false, silent: true, lineStyle: { color: c.faint, type: "dashed", width: 1 } },
        ] };
      metrics = [["AUC", res.auc.toFixed(3)], ["Accuracy", (res.acc * 100).toFixed(1) + "%"], ["F1", res.f1.toFixed(3)], ["Test n", res.nTest]];
    } else if (res.kind === "pca") {
      const ratios = res.scree.map((s) => NODE.round(s.ratio * 100, 1));
      const cum = res.scree.map((s) => NODE.round(s.cumulative * 100, 1));
      option = { grid: { left: 8, right: 40, top: 26, bottom: 26, containLabel: true },
        legend: { top: 0, textStyle: { color: c.text, fontSize: 10 } },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "axis", valueFormatter: (v) => v + "%" },
        xAxis: { type: "category", data: res.scree.map((s) => "PC" + s.pc), axisLabel: { color: c.text, fontSize: 10 }, axisLine: { lineStyle: { color: c.axis } } },
        yAxis: { type: "value", max: 100, axisLabel: { color: c.text, fontSize: 10, formatter: (v) => v + "%" }, splitLine: { lineStyle: { color: c.split } } },
        series: [
          { name: "Explained", type: "bar", data: ratios, itemStyle: { color: pal[0], borderRadius: [3, 3, 0, 0] } },
          { name: "Cumulative", type: "line", data: cum, symbol: "circle", symbolSize: 6, itemStyle: { color: pal[2] }, lineStyle: { color: pal[2], width: 2 } },
        ] };
      metrics = [["PC1", (res.pc1 * 100).toFixed(1) + "%"], ["PC2", (res.pc2 * 100).toFixed(1) + "%"], ["Cum(2)", ((res.pc1 + res.pc2) * 100).toFixed(1) + "%"], ["Vars", res.feats.length]];
    } else if (res.kind === "dbscan" || res.kind === "hier") {
      const ids = [...new Set(res.scatter.map((p) => p.cluster))].sort((a, b) => a - b);
      const series = ids.map((cid) => ({ type: "scatter", name: cid === -1 ? "Noise" : "Cluster " + (cid + 1), symbolSize: 6,
        itemStyle: { color: cid === -1 ? c.faint : pal[cid % 8], opacity: cid === -1 ? 0.4 : 0.7 }, data: res.scatter.filter((p) => p.cluster === cid).map((p) => p.value) }));
      option = { ...Charts.baseGrid(c), grid: { left: 8, right: 16, top: 26, bottom: 30, containLabel: true },
        legend: { top: 0, textStyle: { color: c.text, fontSize: 10 }, type: "scroll" },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item" },
        xAxis: { type: "value", name: res.feats[0], axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        yAxis: { type: "value", name: res.feats[1] || res.feats[0], axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        series };
      metrics = res.kind === "dbscan"
        ? [["Clusters", res.clusters], ["Noise", res.noise], ["Points", res.nTrain], ["eps", res.eps]]
        : [["Clusters", res.K], ["Merges", res.merges.length], ["Points", res.nTrain], ["Method", "Ward"]];
    } else {
      const series = Array.from({ length: res.K }, (_, c2) => ({ type: "scatter", name: "Cluster " + (c2 + 1), symbolSize: 6,
        itemStyle: { color: pal[c2 % 8], opacity: 0.65 }, data: res.scatter.filter((p) => p.cluster === c2).map((p) => p.value) }));
      option = { ...Charts.baseGrid(c), grid: { left: 8, right: 16, top: 26, bottom: 30, containLabel: true },
        legend: { top: 0, textStyle: { color: c.text, fontSize: 10 }, type: "scroll" },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item" },
        xAxis: { type: "value", name: res.feats[0], axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        yAxis: { type: "value", name: res.feats[1] || res.feats[0], axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        series };
      metrics = [["Clusters", res.K], ["Inertia", res.inertia.toLocaleString()], ["Points", res.nTrain], ["Largest", Math.max(...res.sizes)]];
    }

    const summaryParts = summary.split("**");

    return (
      <React.Fragment>
        <div className="phead"><span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
          <Icon name="ml" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />{{ reg: "Linear Regression", clf: "k-NN Classification", dt: "Decision Tree", nb: "Naive Bayes", logit: "Logistic Regression", pca: "Principal Component Analysis", km: "KMeans Clustering", dbscan: "DBSCAN Clustering", hier: "Hierarchical Clustering" }[res.kind] || "Model"}</span>
          <span className="badge mono">{T("mlTrained")} · {res.nTrain} {T("rows")}</span></div>

        {/* Auto-interpretation */}
        {summary && (
          <div className="interpretation-panel" style={{ margin: "8px 12px 0" }}>
            <div className="ip-head"><Icon name="bolt" size={13} /> {T("statInterpretation")}</div>
            <div className="ip-body">{summaryParts.map((p, i) => i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>)}</div>
          </div>
        )}

        <div className="ml-metrics">
          {metrics.map(([k, v]) => <div className="ml-metric" key={k}><div className="mm-val mono">{v}</div><div className="mm-lbl">{k}</div></div>)}
        </div>

        {/* k-fold cross-validation summary */}
        {res.cv && (
          <div className="ml-metrics" style={{ marginTop: 0 }}>
            <div className="ml-metric" style={{ flex: 1 }}>
              <div className="mm-val mono">{res.cv.metric}: {Number.isFinite(res.cv.mean) ? res.cv.mean.toFixed(3) : "—"} ± {Number.isFinite(res.cv.std) ? res.cv.std.toFixed(3) : "—"}</div>
              <div className="mm-lbl">교차검증 ({res.cv.folds.length}-fold)</div>
            </div>
          </div>
        )}

        <div className="ml-chartwrap">
          <div className="ml-charttitle">{{ reg: "Predicted vs actual (test set)", clf: "Confusion matrix", dt: "Confusion matrix · Decision Tree · depth " + (res.depth != null ? res.depth : "?") + " · " + (res.nNodes != null ? res.nNodes : "?") + " nodes", nb: "Confusion matrix · Naive Bayes · class posteriors", logit: "ROC curve · AUC = " + (res.auc != null ? res.auc.toFixed(3) : "—"), pca: "Scree plot · explained variance", km: "Cluster scatter · standardized space", dbscan: "DBSCAN clusters · " + res.feats?.[0] + " vs " + (res.feats?.[1] || res.feats?.[0]), hier: "Hierarchical clusters · " + res.feats?.[0] + " vs " + (res.feats?.[1] || res.feats?.[0]) }[res.kind] || ""}</div>
          <div style={{ flex: 1, minHeight: 0 }}><EChart option={option} theme={theme + res.kind} style={{ height: "100%" }} /></div>
        </div>

        {/* Per-class metrics for classification */}
        {["clf", "dt", "nb"].includes(res.kind) && res.perClass && (
          <div className="clf-metrics">
            <div className="ml-charttitle">{T("mlPerClassMetrics")}</div>
            <table className="model-comparison-table">
              <thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>TP</th><th>FP</th><th>FN</th></tr></thead>
              <tbody>{res.perClass.map((pc) => (
                <tr key={pc.cl}>
                  <td style={{ color: "var(--tx-hi)", fontWeight: 500 }}>{pc.cl}</td>
                  <td className="mono">{(pc.prec * 100).toFixed(1)}%</td>
                  <td className="mono">{(pc.rec * 100).toFixed(1)}%</td>
                  <td className="mono" style={{ color: pc.f1 > 0.75 ? "var(--pos)" : pc.f1 > 0.5 ? "var(--warn)" : "var(--neg)" }}>{pc.f1.toFixed(3)}</td>
                  <td className="mono">{pc.tp}</td><td className="mono">{pc.fp}</td><td className="mono">{pc.fn}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* Cluster means table */}
        {res.kind === "km" && res.clusterMeans && (
          <div className="clf-metrics">
            <div className="ml-charttitle">{T("mlClusterChars")}</div>
            <table className="model-comparison-table">
              <thead><tr><th>{T("mlFeature")}</th>{res.clusterMeans.map((_, i) => <th key={i}>{T("mlCluster")} {i + 1} (n={res.sizes[i]})</th>)}</tr></thead>
              <tbody>{res.feats.map((f) => (
                <tr key={f}>
                  <td style={{ color: "var(--tx-hi)", fontWeight: 500 }}>{f}</td>
                  {res.clusterMeans.map((cm, i) => <td key={i} className="mono">{NODE.fmtCompact(cm[f])}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* Feature importance for regression */}
        {res.kind === "reg" && res.importance && res.importance.length > 0 && (
          <div className="ml-importance">
            <div className="ml-charttitle">Feature importance (standardized coefficient)</div>
            {res.importance.map((f) => <div className="imp-row" key={f.f}><span className="imp-name">{f.f}</span><span className="imp-bar"><span style={{ width: ((res.importance[0].imp ? f.imp / res.importance[0].imp : 0) * 100) + "%" }} /></span><span className="imp-v mono">{f.imp.toFixed(2)}</span></div>)}
          </div>
        )}

        {/* Logistic PR curve */}
        {res.kind === "logit" && res.pr && (
          <div className="ml-chartwrap">
            <div className="ml-charttitle">Precision-Recall curve · AP = {res.ap != null ? res.ap.toFixed(3) : "—"}</div>
            <div style={{ flex: 1, minHeight: 180 }}><EChart theme={theme + "logitpr"} style={{ height: "100%" }}
              option={{ ...Charts.baseGrid(c), grid: { left: 8, right: 16, top: 14, bottom: 34, containLabel: true },
                tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item", formatter: (p) => `recall ${(+p.value[0]).toFixed(2)}<br/>precision ${(+p.value[1]).toFixed(2)}` },
                xAxis: { type: "value", name: "Recall", min: 0, max: 1, axisLabel: { color: c.text, fontSize: 10 }, splitLine: { lineStyle: { color: c.split } } },
                yAxis: { type: "value", name: "Precision", min: 0, max: 1, axisLabel: { color: c.text, fontSize: 10 }, splitLine: { lineStyle: { color: c.split } } },
                series: [{ type: "line", data: res.pr.points.map((p) => [p.recall, p.precision]), showSymbol: false, lineStyle: { color: pal[2], width: 2 }, areaStyle: { color: pal[2], opacity: 0.1 } }] }} /></div>
          </div>
        )}

        {/* Logistic coefficients */}
        {res.kind === "logit" && res.converged === false && (
          <div className="ml-note-warn" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", marginBottom: 8, borderRadius: 6, background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}>
            <Icon name="info" size={14} />
            <span style={{ fontSize: "var(--fs-11)", color: "var(--tx-mid)" }}>{T("mlLogitNotConverged")}</span>
          </div>
        )}
        {res.kind === "logit" && res.coefs && (
          <div className="ml-importance">
            <div className="ml-charttitle">Standardized coefficients · positive class = {String(res.classes[1])}</div>
            {res.coefs.map((cf) => { const mx = Math.max(...res.coefs.map((x) => Math.abs(x.w))) || 1; return (
              <div className="imp-row" key={cf.f}><span className="imp-name">{cf.f}</span><span className="imp-bar"><span style={{ width: (Math.abs(cf.w) / mx * 100) + "%", background: cf.w >= 0 ? "var(--accent)" : "var(--neg)" }} /></span><span className="imp-v mono">{cf.w.toFixed(2)}</span></div>
            ); })}
          </div>
        )}

        {/* PCA loadings */}
        {res.kind === "pca" && res.biplot && (
          <div className="clf-metrics">
            <div className="ml-charttitle">Component loadings (PC1 · PC2)</div>
            <table className="model-comparison-table">
              <thead><tr><th>{T("mlFeature")}</th><th>PC1</th><th>PC2</th></tr></thead>
              <tbody>{res.biplot.loadings.map((l) => (
                <tr key={l.key}><td style={{ color: "var(--tx-hi)", fontWeight: 500 }}>{l.key}</td><td className="mono">{l.x.toFixed(3)}</td><td className="mono">{l.y.toFixed(3)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* Model comparison history */}
        {hist.length > 1 && <ModelHistory hist={hist} />}
      </React.Fragment>
    );
  }

  function ModelHistory({ hist }) {
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    if (!hist || hist.length === 0) return null;
    return (
      <div className="clf-metrics" style={{ padding: "0 12px 12px" }}>
        <div className="ml-charttitle">{T("mlHistoryTitle")} ({hist.length} {T("mlRuns")})</div>
        <table className="model-comparison-table">
          <thead><tr><th>{T("mlHash")}</th><th>{T("mlTask")}</th><th>{T("mlTarget")}</th><th>{T("mlMetric")}</th><th>{T("mlScore")}</th></tr></thead>
          <tbody>{[...hist].reverse().map((h, i) => (
            <tr key={i}>
              <td className="mono" style={{ color: "var(--tx-faint)" }}>{hist.length - i}</td>
              <td style={{ color: "var(--tx-mid)", textTransform: "capitalize" }}>{h.task}</td>
              <td style={{ color: "var(--tx-hi)" }}>{h.target || "—"}</td>
              <td className="mono" style={{ color: "var(--tx-faint)" }}>{{ reg: "R²", clf: "Acc", dt: "Acc", nb: "Acc", logit: "AUC", pca: "PC1", dbscan: "Clusters", hier: "Clusters", km: "Inertia" }[h.task] || "Score"}</td>
              <td className="mono" style={{ color: "var(--accent-hi)", fontWeight: 600 }}>{h.score}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  // mlNums/mlCats/mlDefaultCfg/mlResolveCfg now live in js/mlCfg.js (window.MlCfg), destructured above.

  function MLPanel() {
    const activeId = useStore((s) => s.activeId);
    const cfgS = useStore((s) => s.ui.ml);
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    const { columns, rows } = derive.getActiveData(activeId);
    const numCols = mlNums(columns);
    const catCols = mlCats(columns);
    const cfg = mlResolveCfg(cfgS, columns);
    const set = (patch) => actions.setUI({ ml: { ...cfg, ...patch, result: undefined, trainError: undefined } });

    const elig = mlEligibility(columns, rows);
    // If the persisted task is ineligible for THIS dataset (e.g. switching to a numeric-only dataset
    // while "clf" was selected), auto-switch to the first eligible task so the highlighted task always
    // matches what the center can actually run — no more disabled-but-selected orange (FOLLOWUP §0-0e ①).
    if (!(elig[cfg.task] || {}).ok) {
      const order = ["reg", "clf", "dt", "nb", "logit", "km", "pca", "hier", "dbscan"];
      const fallback = order.find((t) => (elig[t] || {}).ok);
      if (fallback) cfg.task = fallback;
    }
    // Re-heal the target against the (possibly switched) task's eligible targets. mlResolveCfg heals
    // against a guessed cat/num split using the PRE-switch task, so re-anchor here where we know both
    // the final task and per-target class counts (also covers dt/nb, which mlResolveCfg doesn't).
    {
      const vt = (elig[cfg.task] || {}).validTargets || [];
      const supervised = cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb";
      if (supervised && vt.length && !vt.some((t) => t.key === cfg.target)) cfg.target = (vt[0] || {}).key || "";
    }
    const curElig = elig[cfg.task] || { ok: true, validTargets: [] };

    const needsTarget = cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb";
    const featPool = numCols.filter((c) => c.key !== (needsTarget ? cfg.target : null));

    // Logistic one-vs-rest: distinct class VALUES of the selected target.
    const logitClasses = cfg.task === "logit" && cfg.target
      ? [...new Set(rows.map((r) => r[cfg.target]).filter((v) => v != null && v !== "").map(String))]
      : [];

    const isSupervised = cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb";
    const validFeats = cfg.feats.filter((f) => featPool.find((c) => c.key === f));
    const hasValidTarget = curElig.validTargets.some((t) => t.key === cfg.target);
    const canTrain = curElig.ok
      && (!needsTarget || hasValidTarget)
      && (!isSupervised || validFeats.length > 0);

    const train = () => {
      const feats = cfg.feats.filter((f) => featPool.find((c) => c.key === f));
      // reg/clf/logit need at least one feature; clustering falls back to numeric cols below.
      // The Train button is disabled when feats are missing, so this is a defensive no-op.
      if ((cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb") && !feats.length) return;
      window.LOG && window.LOG.info('ml', 'Train started', { task: cfg.task, target: cfg.target, feats, rows: rows.length });
      const clusterFeats = feats.length >= 2 ? feats : numCols.slice(0, 2).map((c) => c.key);
      let result;
      try {
        if (cfg.task === "reg") result = regression(rows, cfg.target, feats, cfg.split);
        else if (cfg.task === "clf") result = classification(rows, cfg.target, feats, cfg.split, cfg.k);
        else if (cfg.task === "dt") result = dtModel(rows, cfg.target, feats, cfg.split);
        else if (cfg.task === "nb") result = nbModel(rows, cfg.target, feats, cfg.split);
        else if (cfg.task === "logit") {
          if (logitClasses.length > 2) {
            const pos = cfg.posClass || logitClasses[0];
            const binRows = rows.map((r) => ({ ...r, __logit_y: String(r[cfg.target]) === String(pos) ? "1" : "0" }));
            result = logisticModel(binRows, "__logit_y", feats, cfg.split);
          } else {
            result = logisticModel(rows, cfg.target, feats, cfg.split);
          }
        }
        else if (cfg.task === "pca") result = pcaModel(rows, clusterFeats);
        else if (cfg.task === "dbscan") result = dbscanModel(rows, clusterFeats, cfg.eps || 0.8, cfg.minPts || 4);
        else if (cfg.task === "hier") result = hierModel(rows, clusterFeats, cfg.K);
        else result = kmeans(rows, clusterFeats, cfg.K);
      } catch (err) {
        window.LOG && window.LOG.error('ml', 'Train failed: ' + err.message, { task: cfg.task, target: cfg.target, feats, stack: err.stack });
        actions.setUI({ ml: { ...cfg, result: null, trainError: err.message } });
        return;
      }

      // Optional k-fold cross-validation (additive; failure never breaks training).
      if (cfg.cv >= 2 && (cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb")) {
        try {
          result.cv = runCV(cfg.task, rows, feats, cfg.target, cfg.split, cfg.cv);
        } catch (err) {
          window.LOG && window.LOG.error('ml', 'CV failed: ' + err.message, { task: cfg.task });
          result.cv = null;
        }
      }

      // push to history
      const score = result.kind === "reg" ? result.r2.toFixed(3)
        : result.kind === "clf" ? (result.acc * 100).toFixed(1) + "%"
        : result.kind === "dt" || result.kind === "nb" ? (result.acc * 100).toFixed(1) + "%"
        : result.kind === "logit" ? "AUC " + result.auc.toFixed(3)
        : result.kind === "pca" ? (result.pc1 * 100).toFixed(1) + "% PC1"
        : result.kind === "dbscan" ? result.clusters + " clusters"
        : result.kind === "hier" ? result.K + " clusters"
        : result.inertia.toLocaleString();
      pushHistory({ task: cfg.task, target: cfg.target || null, feats, score, kind: result.kind });
      window.LOG && window.LOG.info('ml', 'Train completed', { task: cfg.task, target: cfg.target, score, feats });

      actions.setUI({ ml: { ...cfg, result } });
    };

    return (
      <div className="mlpanel">
        <div className="cp-block">
          <div className="cp-blocktitle">{T("mlTask")}</div>
          <div className="ml-tasks">
            {[["reg", "Regression"], ["clf", "k-NN Classify"], ["logit", "Logistic + ROC"], ["dt", "Decision Tree"], ["nb", "Naive Bayes"], ["pca", "PCA"], ["km", "KMeans"], ["dbscan", "DBSCAN"], ["hier", "Hierarchical"]].map(([k, l]) => {
              const e = elig[k] || { ok: true, validTargets: [] };
              return <button key={k} disabled={!e.ok} title={e.ok ? "" : e.reason}
                className={"ml-taskbtn" + (cfg.task === k ? " on" : "") + (e.ok ? "" : " disabled")}
                onClick={() => set({ task: k, target: (e.validTargets[0] || {}).key })}>{l}</button>;
            })}
          </div>
        </div>

        {needsTarget && (
          <div className="cp-block">
            <div className="cp-blocktitle">{T("mlTarget")}{cfg.task === "logit" ? T("mlBinarySuffix") : ""}</div>
            <select className="sel" style={{ width: "100%" }} value={cfg.target} onChange={(e) => set({ target: e.target.value })}>
              {curElig.validTargets.length
                ? curElig.validTargets.map((c) => <option key={c.key} value={c.key}>{c.classes ? `${c.label} (${c.classes} 클래스)` : c.label}</option>)
                : <option value="" disabled>적격 대상 없음</option>}
            </select>
          </div>
        )}

        {cfg.task === "logit" && logitClasses.length > 2 && (
          <div className="cp-block">
            <div className="cp-blocktitle">양성 클래스</div>
            <select className="sel" style={{ width: "100%" }} value={cfg.posClass || logitClasses[0]} onChange={(e) => set({ posClass: e.target.value })}>
              {logitClasses.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        <div className="cp-block">
          <div className="cp-blocktitle">{T("mlFeatures")}</div>
          <div className="ml-feats">
            {featPool.map((c) => {
              const on = cfg.feats.includes(c.key);
              return (
                <div key={c.key} className="ml-feat" onClick={() => set({ feats: on ? cfg.feats.filter((f) => f !== c.key) : [...cfg.feats, c.key] })}>
                  <span className={"checkbox" + (on ? " on" : "")}>{on && <Icon name="check" size={11} />}</span>{c.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cp-block">
          <div className="cp-blocktitle">{T("mlHyperparameters")}</div>
          {(cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb") && (
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Test split</span>
              <div className="seg">{[0.2, 0.3, 0.4].map((s) => <button key={s} className={cfg.split === s ? "on" : ""} onClick={() => set({ split: s })}>{s * 100}%</button>)}</div></div>
          )}
          {cfg.task === "clf" && (
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>k (neighbors)</span>
              <div className="seg">{[3, 5, 9].map((k) => <button key={k} className={cfg.k === k ? "on" : ""} onClick={() => set({ k })}>{k}</button>)}</div></div>
          )}
          {(cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit" || cfg.task === "dt" || cfg.task === "nb") && (
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Cross-validation</span>
              <div className="seg">{[["Off", 0], ["5-fold", 5]].map(([l, v]) => <button key={v} className={(cfg.cv || 0) === v ? "on" : ""} onClick={() => set({ cv: v })}>{l}</button>)}</div></div>
          )}
          {(cfg.task === "km" || cfg.task === "hier") && (
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Clusters (K)</span>
              <div className="seg">{[2, 3, 4, 5].map((K) => <button key={K} className={cfg.K === K ? "on" : ""} onClick={() => set({ K })}>{K}</button>)}</div></div>
          )}
          {cfg.task === "dbscan" && (
            <React.Fragment>
              <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>eps (radius)</span>
                <div className="seg">{[0.5, 0.8, 1.2, 1.6].map((e) => <button key={e} className={(cfg.eps || 0.8) === e ? "on" : ""} onClick={() => set({ eps: e })}>{e}</button>)}</div></div>
              <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>minPts</span>
                <div className="seg">{[3, 4, 6, 8].map((mp) => <button key={mp} className={(cfg.minPts || 4) === mp ? "on" : ""} onClick={() => set({ minPts: mp })}>{mp}</button>)}</div></div>
            </React.Fragment>
          )}
          {(cfg.task === "pca") && <div className="fieldlabel" style={{ margin: 0 }}>표준화 후 주성분 분해 · Scree + Biplot</div>}
        </div>

        {rows.length > 5000 && (cfg.task === "dbscan" || cfg.task === "hier") && (
          <div className="cf-info" style={{ borderColor: "var(--warn)" }}><Icon name="info" size={14} /><div>{rows.length.toLocaleString()}행 — {cfg.task === "dbscan" ? "DBSCAN" : "계층군집"}은 O(n²)라 5k행 초과 시 느릴 수 있습니다.</div></div>
        )}
        <button className="btn primary" style={{ width: "100%", height: 32 }} disabled={!canTrain} onClick={train}><Icon name="play" size={13} /> {T("mlTrainModel")}</button>
        {!canTrain && (
          <div className="cf-info" style={{ borderColor: "var(--warn)" }}><Icon name="info" size={14} /><div>{
            !curElig.ok ? curElig.reason
              : (needsTarget && !hasValidTarget) ? "적격한 목표가 없습니다"
              : "특성을 1개 이상 선택하세요"
          }</div></div>
        )}
        {cfg.trainError && !cfg.result && (
          <div className="cf-info" style={{ borderColor: "var(--neg)" }}><Icon name="info" size={14} /><div>{cfg.trainError}</div></div>
        )}
        <div className="cf-info"><Icon name="bolt" size={14} /><div>{{
          reg: "OLS via normal equations",
          clf: "k-NN on standardized features + Precision/Recall/F1",
          logit: "Logistic regression (gradient descent) + ROC/AUC",
          dt: "CART gini decision tree + confusion matrix / F1",
          nb: "Gaussian Naive Bayes + confusion matrix / F1",
          pca: "Principal Component Analysis (Jacobi eigen) + Scree/Biplot",
          km: "Lloyd's KMeans + cluster characteristics table",
          dbscan: "Density-based clustering (eps/minPts) + noise detection",
          hier: "Agglomerative hierarchical (Ward) + flat cut at K",
        }[cfg.task] || ""} {T("mlComputedLocally")}</div></div>
      </div>
    );
  }

  window.MlMode = function () {
    const lang = useStore((s) => s.tweaks.lang) || "ko";
    const T = (k) => window.I18N.t(lang, k);
    return <window.Workspace left={<window.DatasetTree />} leftTitle={T("dashDataExplorer")}
      center={<MLCenter />} right={<MLPanel />} rightTitle={T("mlModelConfig")} />;
  };
})();
