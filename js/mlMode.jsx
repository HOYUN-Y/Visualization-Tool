/* NØDE/Insight — ML Studio (JMP-enhanced): regression, k-NN, KMeans + model comparison */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts;
  const EChart = Charts.EChart;
  const IE = window.IE;

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
      const predClass = Object.entries(vote).sort((a, b) => b[1] - a[1])[0][0];
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
    return { kind: "logit", classes: model.classes, roc, pr, coefs, feats, target, acc: m.accuracy, auc: roc.auc, ap: pr ? pr.ap : null, f1: m.f1, prec: m.precision, rec: m.recall, nTrain: tr.length, nTest: te.length };
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
    const res = cfg.result;
    const hist = window.NODE.mlHistory || [];

    if (!res) return (
      <React.Fragment>
        <div className="phead"><span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
          <Icon name="ml" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Machine Learning Studio</span></div>
        <div className="empty"><Icon name="ml" /><div className="t">Configure & train a model</div><div className="s">Pick a task, target, and features on the right, then <b>Train model</b>. Everything runs locally — OLS regression, k-NN, <b>Logistic + ROC</b>, <b>PCA</b>, KMeans, <b>DBSCAN</b>, and <b>Hierarchical</b> clustering.</div></div>
        {hist.length > 0 && <ModelHistory hist={hist} />}
      </React.Fragment>
    );

    const c = Charts.themeColors(), pal = Charts.palette();
    const summary = IE && (res.kind === "reg" || res.kind === "clf" || res.kind === "km") ? (
      res.kind === "reg" ? IE.summarizeRegression({ r2: res.r2, adj: 1 - (1 - res.r2) * res.nTrain / (res.nTrain - 2), terms: [], target: res.target, pF: 0 }) :
      res.kind === "clf" ? IE.summarizeClassification(res) :
      IE.summarizeClustering(res)
    ) : "";

    let option, metrics;
    if (res.kind === "reg") {
      const lo = Math.min(...res.scatter.flat()), hi = Math.max(...res.scatter.flat());
      option = { ...Charts.baseGrid(c), grid: { left: 8, right: 16, top: 16, bottom: 30, containLabel: true },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item", formatter: (p) => `actual ${NODE.fmtCompact(p.value[0])}<br/>pred ${NODE.fmtCompact(p.value[1])}` },
        xAxis: { type: "value", name: "actual", min: lo, max: hi, axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        yAxis: { type: "value", name: "predicted", min: lo, max: hi, axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        series: [{ type: "scatter", symbolSize: 6, data: res.scatter, itemStyle: { color: pal[0], opacity: 0.6 },
          markLine: { silent: true, symbol: "none", lineStyle: { color: c.faint, type: "dashed" }, data: [[{ coord: [lo, lo] }, { coord: [hi, hi] }]] } }] };
      metrics = [["R²", res.r2.toFixed(3)], ["RMSE", NODE.fmtCompact(res.rmse)], ["MAE", NODE.fmtCompact(res.mae)], ["Test n", res.nTest]];
    } else if (res.kind === "clf") {
      const data = []; res.cm.forEach((row, i) => row.forEach((v, j) => data.push([j, i, v])));
      const maxV = Math.max(...res.cm.flat(), 1);
      option = { animation: false, grid: { left: 8, right: 60, top: 10, bottom: 60, containLabel: true },
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
      option = { animation: false, grid: { left: 8, right: 40, top: 26, bottom: 26, containLabel: true },
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
          <Icon name="ml" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />{{ reg: "Linear Regression", clf: "k-NN Classification", logit: "Logistic Regression", pca: "Principal Component Analysis", km: "KMeans Clustering", dbscan: "DBSCAN Clustering", hier: "Hierarchical Clustering" }[res.kind] || "Model"}</span>
          <span className="badge mono">trained · {res.nTrain} rows</span></div>

        {/* Auto-interpretation */}
        {summary && (
          <div className="interpretation-panel" style={{ margin: "8px 12px 0" }}>
            <div className="ip-head"><Icon name="bolt" size={13} /> Interpretation</div>
            <div className="ip-body">{summaryParts.map((p, i) => i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>)}</div>
          </div>
        )}

        <div className="ml-metrics">
          {metrics.map(([k, v]) => <div className="ml-metric" key={k}><div className="mm-val mono">{v}</div><div className="mm-lbl">{k}</div></div>)}
        </div>

        <div className="ml-chartwrap">
          <div className="ml-charttitle">{{ reg: "Predicted vs actual (test set)", clf: "Confusion matrix", logit: "ROC curve · AUC = " + (res.auc != null ? res.auc.toFixed(3) : "—"), pca: "Scree plot · explained variance", km: "Cluster scatter · standardized space", dbscan: "DBSCAN clusters · " + res.feats[0] + " vs " + (res.feats[1] || res.feats[0]), hier: "Hierarchical clusters · " + res.feats[0] + " vs " + (res.feats[1] || res.feats[0]) }[res.kind] || ""}</div>
          <div style={{ flex: 1, minHeight: 0 }}><EChart option={option} theme={theme + res.kind} style={{ height: "100%" }} /></div>
        </div>

        {/* Per-class metrics for classification */}
        {res.kind === "clf" && res.perClass && (
          <div className="clf-metrics">
            <div className="ml-charttitle">Per-class metrics</div>
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
            <div className="ml-charttitle">Cluster characteristics (original scale)</div>
            <table className="model-comparison-table">
              <thead><tr><th>Feature</th>{res.clusterMeans.map((_, i) => <th key={i}>Cluster {i + 1} (n={res.sizes[i]})</th>)}</tr></thead>
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
        {res.kind === "reg" && (
          <div className="ml-importance">
            <div className="ml-charttitle">Feature importance (standardized coefficient)</div>
            {res.importance.map((f) => <div className="imp-row" key={f.f}><span className="imp-name">{f.f}</span><span className="imp-bar"><span style={{ width: (f.imp / res.importance[0].imp * 100) + "%" }} /></span><span className="imp-v mono">{f.imp.toFixed(2)}</span></div>)}
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
              <thead><tr><th>Feature</th><th>PC1</th><th>PC2</th></tr></thead>
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
    if (!hist || hist.length === 0) return null;
    return (
      <div className="clf-metrics" style={{ padding: "0 12px 12px" }}>
        <div className="ml-charttitle">Model comparison history ({hist.length} runs)</div>
        <table className="model-comparison-table">
          <thead><tr><th>#</th><th>Task</th><th>Target</th><th>Metric</th><th>Score</th></tr></thead>
          <tbody>{[...hist].reverse().map((h, i) => (
            <tr key={i}>
              <td className="mono" style={{ color: "var(--tx-faint)" }}>{hist.length - i}</td>
              <td style={{ color: "var(--tx-mid)", textTransform: "capitalize" }}>{h.task}</td>
              <td style={{ color: "var(--tx-hi)" }}>{h.target || "—"}</td>
              <td className="mono" style={{ color: "var(--tx-faint)" }}>{{ reg: "R²", clf: "Acc", logit: "AUC", pca: "PC1", dbscan: "Clusters", hier: "Clusters", km: "Inertia" }[h.task] || "Score"}</td>
              <td className="mono" style={{ color: "var(--accent-hi)", fontWeight: 600 }}>{h.score}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  function MLPanel() {
    const activeId = useStore((s) => s.activeId);
    const cfgS = useStore((s) => s.ui.ml);
    const { columns, rows } = derive.getActiveData(activeId);
    const numCols = columns.filter((c) => c.type === "integer" || c.type === "float");
    const catCols = columns.filter((c) => c.type === "category");
    const cfg = cfgS || { task: "reg", target: "price_manwon", feats: ["area_m2", "floor", "built_year"], split: 0.3, k: 5, K: 3 };
    const set = (patch) => actions.setUI({ ml: { ...cfg, ...patch, result: undefined } });

    const needsTarget = cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit";
    const targets = (cfg.task === "clf" || cfg.task === "logit") ? catCols : numCols;
    const featPool = numCols.filter((c) => c.key !== (needsTarget ? cfg.target : null));

    const train = () => {
      const feats = cfg.feats.filter((f) => featPool.find((c) => c.key === f));
      window.LOG && window.LOG.info('ml', 'Train started', { task: cfg.task, target: cfg.target, feats, rows: rows.length });
      const clusterFeats = feats.length >= 2 ? feats : numCols.slice(0, 2).map((c) => c.key);
      let result;
      try {
        if (cfg.task === "reg") result = regression(rows, cfg.target, feats, cfg.split);
        else if (cfg.task === "clf") result = classification(rows, cfg.target, feats, cfg.split, cfg.k);
        else if (cfg.task === "logit") result = logisticModel(rows, cfg.target, feats, cfg.split);
        else if (cfg.task === "pca") result = pcaModel(rows, clusterFeats);
        else if (cfg.task === "dbscan") result = dbscanModel(rows, clusterFeats, cfg.eps || 0.8, cfg.minPts || 4);
        else if (cfg.task === "hier") result = hierModel(rows, clusterFeats, cfg.K);
        else result = kmeans(rows, clusterFeats, cfg.K);
      } catch (err) {
        window.LOG && window.LOG.error('ml', 'Train failed: ' + err.message, { task: cfg.task, target: cfg.target, feats, stack: err.stack });
        alert(err.message);
        return;
      }

      // push to history
      const score = result.kind === "reg" ? result.r2.toFixed(3)
        : result.kind === "clf" ? (result.acc * 100).toFixed(1) + "%"
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
          <div className="cp-blocktitle">Task</div>
          <div className="ml-tasks">
            {[["reg", "Regression"], ["clf", "k-NN Classify"], ["logit", "Logistic + ROC"], ["pca", "PCA"], ["km", "KMeans"], ["dbscan", "DBSCAN"], ["hier", "Hierarchical"]].map(([k, l]) => {
              const catTask = k === "clf" || k === "logit";
              return <button key={k} className={"ml-taskbtn" + (cfg.task === k ? " on" : "")}
                onClick={() => set({ task: k, target: catTask ? (catCols[1] || catCols[0] || {}).key : "price_manwon" })}>{l}</button>;
            })}
          </div>
        </div>

        {needsTarget && (
          <div className="cp-block">
            <div className="cp-blocktitle">Target{cfg.task === "logit" ? " (binary)" : ""}</div>
            <select className="sel" style={{ width: "100%" }} value={cfg.target} onChange={(e) => set({ target: e.target.value })}>
              {targets.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        )}

        <div className="cp-block">
          <div className="cp-blocktitle">Features</div>
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
          <div className="cp-blocktitle">Hyperparameters</div>
          {(cfg.task === "reg" || cfg.task === "clf" || cfg.task === "logit") && (
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>Test split</span>
              <div className="seg">{[0.2, 0.3, 0.4].map((s) => <button key={s} className={cfg.split === s ? "on" : ""} onClick={() => set({ split: s })}>{s * 100}%</button>)}</div></div>
          )}
          {cfg.task === "clf" && (
            <div className="ctl-row"><span className="fieldlabel" style={{ margin: 0 }}>k (neighbors)</span>
              <div className="seg">{[3, 5, 9].map((k) => <button key={k} className={cfg.k === k ? "on" : ""} onClick={() => set({ k })}>{k}</button>)}</div></div>
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
        <button className="btn primary" style={{ width: "100%", height: 32 }} onClick={train}><Icon name="play" size={13} /> Train model</button>
        <div className="cf-info"><Icon name="bolt" size={14} /><div>{{
          reg: "OLS via normal equations",
          clf: "k-NN on standardized features + Precision/Recall/F1",
          logit: "Logistic regression (gradient descent) + ROC/AUC",
          pca: "Principal Component Analysis (Jacobi eigen) + Scree/Biplot",
          km: "Lloyd's KMeans + cluster characteristics table",
          dbscan: "Density-based clustering (eps/minPts) + noise detection",
          hier: "Agglomerative hierarchical (Ward) + flat cut at K",
        }[cfg.task] || ""} — computed locally.</div></div>
      </div>
    );
  }

  window.MlMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<MLCenter />} right={<MLPanel />} rightTitle="Model Config" />;
  };
})();
