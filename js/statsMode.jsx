/* NØDE/Insight — Statistical Analysis Studio (JMP-enhanced) */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts, SM = window.SM;
  const EChart = Charts.EChart;
  const IE = window.IE;
  const num = (a) => a.filter((v) => v != null && v !== "" && !isNaN(v)).map(Number);

  const TESTS = [
    { k: "descriptive", label: "Descriptive", icon: "stats" },
    { k: "distribution", label: "Distribution", icon: "bar" },
    { k: "corr", label: "Correlation", icon: "heatmap" },
    { k: "ttest", label: "T-Test", icon: "kpi" },
    { k: "anova", label: "ANOVA", icon: "bar" },
    { k: "chisq", label: "Chi-Square", icon: "treemap" },
    { k: "reg", label: "Regression", icon: "scatter" },
    { k: "builder", label: "Analysis Builder", icon: "bolt" },
  ];
  const sigStars = (p) => p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "n.s.";
  const fmtP = (p) => p < 0.0001 ? "< 0.0001" : p.toFixed(4);

  // ---------- test functions ----------
  function rank(arr) {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    idx.forEach(([_, i], k) => (r[i] = k + 1));
    return r;
  }

  function corrMatrix(rows, cols, method) {
    const data = cols.map((c) => rows.map((r) => r[c.key]));
    const m = cols.map(() => cols.map(() => 0));
    for (let i = 0; i < cols.length; i++) for (let j = 0; j < cols.length; j++) {
      if (method === "spearman") {
        const idx = data[i].map((_, k) => k).filter((k) => data[i][k] != null && data[j][k] != null);
        const rx = rank(idx.map((k) => data[i][k])), ry = rank(idx.map((k) => data[j][k]));
        m[i][j] = stat.pearson(rx, ry);
      } else {
        m[i][j] = stat.pearson(data[i], data[j]);
      }
    }
    return m;
  }

  function ttest(rows, measure, group, l1, l2) {
    const a = num(rows.filter((r) => String(r[group]) === l1).map((r) => r[measure]));
    const b = num(rows.filter((r) => String(r[group]) === l2).map((r) => r[measure]));
    const ma = stat.mean(a), mb = stat.mean(b), va = stat.std(a) ** 2, vb = stat.std(b) ** 2, na = a.length, nb = b.length;
    const t = (ma - mb) / Math.sqrt(va / na + vb / nb);
    const df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
    const p = SM.tP(t, df);
    const pooled = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
    const d = (ma - mb) / pooled;
    return { ma, mb, na, nb, t, df, p, d, l1, l2, sa: Math.sqrt(va), sb: Math.sqrt(vb) };
  }

  function anova(rows, measure, group) {
    const groups = {};
    for (const r of rows) { const g = r[group], v = r[measure]; if (v != null && !isNaN(v)) (groups[g] = groups[g] || []).push(+v); }
    const keys = Object.keys(groups), all = keys.flatMap((k) => groups[k]), grand = stat.mean(all), N = all.length, k = keys.length;
    let ssb = 0, ssw = 0;
    const means = {};
    for (const key of keys) { const g = groups[key], mg = stat.mean(g); means[key] = { mean: mg, n: g.length, sd: stat.std(g) }; ssb += g.length * (mg - grand) ** 2; for (const x of g) ssw += (x - mg) ** 2; }
    const df1 = k - 1, df2 = N - k, msb = ssb / df1, msw = ssw / df2, F = msb / msw, p = SM.fP(F, df1, df2), eta2 = ssb / (ssb + ssw);
    return { means, F, df1, df2, p, eta2, k, N };
  }

  function chisq(rows, A, B) {
    const aL = [...new Set(rows.map((r) => r[A]))], bL = [...new Set(rows.map((r) => r[B]))];
    const O = aL.map(() => bL.map(() => 0)); let N = 0;
    for (const r of rows) { const i = aL.indexOf(r[A]), j = bL.indexOf(r[B]); if (i >= 0 && j >= 0) { O[i][j]++; N++; } }
    const rowT = O.map((r) => r.reduce((s, v) => s + v, 0)), colT = bL.map((_, j) => O.reduce((s, r) => s + r[j], 0));
    let chi = 0;
    const E = O.map((r, i) => r.map((o, j) => { const e = rowT[i] * colT[j] / N; chi += (o - e) ** 2 / e; return e; }));
    const df = (aL.length - 1) * (bL.length - 1), p = SM.chiP(chi, df);
    const V = Math.sqrt(chi / (N * Math.min(aL.length - 1, bL.length - 1)));
    return { aL, bL, O, E, chi, df, p, V, N };
  }

  function regression(rows, target, preds) {
    const data = rows.filter((r) => preds.every((f) => r[f] != null) && r[target] != null);
    const n = data.length, p = preds.length + 1;
    const X = data.map((r) => [1, ...preds.map((f) => +r[f])]), y = data.map((r) => +r[target]);
    const A = Array.from({ length: p }, () => Array(p).fill(0)), Xty = Array(p).fill(0);
    for (let i = 0; i < n; i++) for (let a = 0; a < p; a++) { Xty[a] += X[i][a] * y[i]; for (let b = 0; b < p; b++) A[a][b] += X[i][a] * X[i][b]; }
    const Ainv = SM.matInverse(A);
    const coef = Ainv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const pred = (r) => coef.reduce((s, c, j) => s + c * (j === 0 ? 1 : +r[preds[j - 1]]), 0);
    const ym = stat.mean(y); let rss = 0, tss = 0;
    for (let i = 0; i < n; i++) { rss += (y[i] - pred(data[i])) ** 2; tss += (y[i] - ym) ** 2; }
    const df = n - p, sigma2 = rss / df;
    const terms = ["(Intercept)", ...preds].map((name, j) => { const se = Math.sqrt(sigma2 * Ainv[j][j]); const t = coef[j] / se; return { name, coef: coef[j], se, t, p: SM.tP(t, df) }; });
    const r2 = 1 - rss / tss, adj = 1 - (1 - r2) * (n - 1) / df, F = (tss - rss) / (p - 1) / (rss / df), pF = SM.fP(F, p - 1, df);
    return { terms, r2, adj, F, df1: p - 1, df2: df, pF, n, target };
  }

  // ---------- distribution helpers ----------
  function distStats(rows, key) {
    const vals = rows.map((r) => r[key]);
    const nx = num(vals);
    const cs = derive.colStats(rows, key);
    const iqr = (cs.q3 - cs.q1) || 1;
    const outliers = nx.filter((v) => v < cs.q1 - 1.5 * iqr || v > cs.q3 + 1.5 * iqr).length;
    return {
      n: nx.length,
      missing: stat.missing(vals),
      mean: stat.mean(vals),
      median: stat.median(vals),
      std: stat.std(vals),
      min: stat.min(vals),
      max: stat.max(vals),
      q1: cs.q1, q3: cs.q3, iqr,
      skewness: SM.skewness ? SM.skewness(nx) : null,
      kurtosis: SM.kurtosis ? SM.kurtosis(nx) : null,
      outliers,
      hist: stat.histogram(vals, 20),
    };
  }

  // ---------- shared UI ----------
  function Verdict({ p, msg }) {
    const sig = p < 0.05;
    return (
      <div className={"verdict " + (sig ? "sig" : "ns")}>
        <span className="v-badge">{sig ? "SIGNIFICANT" : "NOT SIGNIFICANT"} · p {p < 0.0001 ? "< .0001" : "= " + p.toFixed(4)}</span>
        <div className="v-msg">{msg}</div>
      </div>
    );
  }
  function Cards({ items }) {
    return <div className="stat-cards">{items.map(([l, v, sub]) => (
      <div className="stat-card" key={l}><div className="sc-val mono">{v}</div><div className="sc-lbl">{l}{sub ? <span className="sc-sub"> {sub}</span> : ""}</div></div>
    ))}</div>;
  }
  function InterpretationPanel({ text, icon }) {
    if (!text) return null;
    const parts = text.split("**");
    return (
      <div className="interpretation-panel">
        <div className="ip-head"><Icon name={icon || "bolt"} size={13} /> Interpretation</div>
        <div className="ip-body">{parts.map((p, i) => i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>)}</div>
      </div>
    );
  }
  function NextStepPanel({ context }) {
    if (!IE || !context) return null;
    const ns = IE.recommendNextStep(context);
    if (!ns) return null;
    const parts = ns.text.split("**");
    return (
      <div className="nextstep-panel">
        <div className="ns-head"><Icon name={ns.icon} size={13} /> Recommended Next Step</div>
        <div className="ns-body">{parts.map((p, i) => i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>)}</div>
      </div>
    );
  }
  function MeansBar({ means, theme }) {
    const c = Charts.themeColors(), pal = Charts.palette();
    const keys = Object.keys(means), data = keys.map((k) => means[k].mean);
    const option = { ...Charts.baseGrid(c), grid: { left: 8, right: 14, top: 16, bottom: keys.length > 6 ? 50 : 24, containLabel: true },
      tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "axis" },
      xAxis: { type: "category", data: keys, axisLabel: { color: c.text, fontSize: 10, rotate: keys.length > 6 ? 32 : 0, interval: 0 }, axisLine: { lineStyle: { color: c.axis } } },
      yAxis: { type: "value", axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
      series: [{ type: "bar", data: data.map((v, i) => ({ value: v, itemStyle: { color: pal[i % 8], borderRadius: [3, 3, 0, 0] } })), barMaxWidth: 46 }] };
    return <div style={{ height: 180 }}><EChart option={option} theme={theme} style={{ height: "100%" }} /></div>;
  }

  // ---------- Distribution tab ----------
  function DistributionCenter({ rows, columns, cfg, theme }) {
    const numCols = columns.filter((c) => c.type === "integer" || c.type === "float");
    const colKey = cfg.distCol || (numCols[0] && numCols[0].key);
    const col = columns.find((c) => c.key === colKey);
    if (!col || !numCols.length) return <div className="empty"><div className="t">No numeric columns</div></div>;

    const ds = distStats(rows, colKey);
    const c = Charts.themeColors(), pal = Charts.palette();

    const histBins = ds.hist.bins;
    const histOpt = {
      animation: false,
      grid: { left: 8, right: 8, top: 8, bottom: 28, containLabel: true },
      tooltip: { trigger: "item", backgroundColor: c.tooltipBg, borderColor: c.axis, textStyle: { color: c.textHi, fontSize: 11 },
        formatter: (p) => `${NODE.fmtCompact(histBins[p.dataIndex] ? histBins[p.dataIndex].x0 : 0)}–${NODE.fmtCompact(histBins[p.dataIndex] ? histBins[p.dataIndex].x1 : 0)}: <b>${p.value}</b>` },
      xAxis: { type: "category", data: histBins.map((b) => NODE.fmtCompact(b.x0)),
        axisLabel: { color: c.text, fontSize: 9, interval: 4, rotate: 20 }, axisLine: { lineStyle: { color: c.axis } } },
      yAxis: { type: "value", axisLabel: { color: c.text, fontSize: 9 }, splitLine: { lineStyle: { color: c.split } } },
      series: [{ type: "bar", data: histBins.map((b) => b.c), barWidth: "98%",
        itemStyle: { color: pal[0], opacity: 0.8, borderRadius: [2, 2, 0, 0] } }],
    };

    const outlierVals = rows.map((r) => r[colKey]).filter((v) => v != null && !isNaN(v) && (v < ds.q1 - 1.5 * ds.iqr || v > ds.q3 + 1.5 * ds.iqr));
    const boxOpt = {
      animation: false,
      grid: { left: 8, right: 8, top: 8, bottom: 22, containLabel: true },
      tooltip: { trigger: "item", backgroundColor: c.tooltipBg, borderColor: c.axis, textStyle: { color: c.textHi, fontSize: 11 },
        formatter: (p) => p.seriesType === "boxplot"
          ? `Min ${NODE.fmtCompact(p.value[1])} · Q1 ${NODE.fmtCompact(p.value[2])} · Median ${NODE.fmtCompact(p.value[3])} · Q3 ${NODE.fmtCompact(p.value[4])} · Max ${NODE.fmtCompact(p.value[5])}`
          : `Outlier: ${NODE.fmtCompact(p.value[0])}` },
      xAxis: { type: "value", min: ds.min, max: ds.max, axisLabel: { color: c.text, fontSize: 9, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
      yAxis: { type: "category", data: [col.label], axisLabel: { color: c.text, fontSize: 9 } },
      series: [
        { type: "boxplot", layout: "horizontal", boxWidth: ["20%", "50%"],
          data: [[ds.min, ds.q1, ds.median, ds.q3, ds.max]],
          itemStyle: { color: `${pal[0]}28`, borderColor: pal[0], borderWidth: 1.5 } },
        { type: "scatter", data: outlierVals.map((v) => [v, col.label]), symbolSize: 6,
          itemStyle: { color: pal[1], opacity: 0.75 } },
      ],
    };

    const sk = ds.skewness, ku = ds.kurtosis;
    const skDesc = sk == null ? "—" : Math.abs(sk) < 0.5 ? "approx. symmetric" : (sk > 0 ? "right-skewed" : "left-skewed") + ` (${sk.toFixed(2)})`;
    const kuDesc = ku == null ? "—" : ku > 1 ? `leptokurtic (${ku.toFixed(2)})` : ku < -1 ? `platykurtic (${ku.toFixed(2)})` : `normal-like (${ku.toFixed(2)})`;

    const interpText = `**${col.label}** distribution: ${skDesc}${ku != null ? ", " + kuDesc : ""}. ${ds.outliers > 0 ? `**${ds.outliers}** outlier(s) detected by IQR method.` : "No outliers detected."}`;

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
            <Icon name="bar" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Distribution · {col.label}
          </span>
          <div className="spacer" />
          <span className="badge mono">n = {ds.n}</span>
        </div>
        <div className="pbody statsbody">
          <Cards items={[
            ["n (valid)", ds.n], ["Missing", ds.missing],
            ["Skewness", sk != null ? sk.toFixed(3) : "—", sk != null && Math.abs(sk) > 1.5 ? "!" : ""],
            ["Kurtosis (excess)", ku != null ? ku.toFixed(3) : "—"],
          ]} />
          <Cards items={[
            ["Mean", NODE.fmtNum(ds.mean, 2)], ["Median", NODE.fmtNum(ds.median, 2)],
            ["Std Dev", NODE.fmtNum(ds.std, 2)], ["IQR Outliers", ds.outliers],
          ]} />
          <div className="result-section">
            <div className="rs-label">Histogram</div>
            <div style={{ height: 160 }}><EChart option={histOpt} theme={theme} style={{ height: "100%" }} /></div>
          </div>
          <div className="result-section">
            <div className="rs-label">Boxplot</div>
            <div style={{ height: 70 }}><EChart option={boxOpt} theme={theme} style={{ height: "100%" }} /></div>
          </div>
          <InterpretationPanel text={interpText} icon="bar" />
          <NextStepPanel context={{ lastTest: "distribution" }} />
        </div>
      </React.Fragment>
    );
  }

  // ---------- Analysis Builder ----------
  function runBuilder(rows, columns, target, inputs) {
    const targetCol = columns.find((c) => c.key === target);
    const inputCols = inputs.map((k) => columns.find((c) => c.key === k)).filter(Boolean);
    if (!targetCol || !inputCols.length) return null;

    const numInputs = inputCols.filter((c) => c.type === "integer" || c.type === "float");
    const catInputs = inputCols.filter((c) => c.type === "category");
    const isNumTarget = targetCol.type === "integer" || targetCol.type === "float";
    const isCatTarget = targetCol.type === "category";

    if (isNumTarget && numInputs.length >= 1) {
      const r = regression(rows, target, numInputs.map((c) => c.key));
      const summary = IE ? IE.summarizeRegression(r) : "";
      const nextStep = IE ? IE.recommendNextStep({ lastTest: "reg", lastResult: r }) : null;
      return { type: "regression", data: r, summary, nextStep, targetCol, numInputs };
    }
    if (isNumTarget && catInputs.length >= 1) {
      const r = anova(rows, target, catInputs[0].key);
      const summary = `One-way ANOVA: **${targetCol.label}** by **${catInputs[0].label}**. F=${r.F.toFixed(2)}, p=${fmtP(r.p)}, η²=${r.eta2.toFixed(3)}.`;
      const nextStep = IE ? IE.recommendNextStep({ lastTest: "anova", lastResult: r }) : null;
      return { type: "anova", data: r, summary, nextStep, targetCol, groupCol: catInputs[0] };
    }
    if (isCatTarget && catInputs.length >= 1) {
      const r = chisq(rows, target, catInputs[0].key);
      const summary = `Chi-square: **${targetCol.label}** × **${catInputs[0].label}**. χ²=${r.chi.toFixed(2)}, p=${fmtP(r.p)}, V=${r.V.toFixed(3)}.`;
      const nextStep = IE ? IE.recommendNextStep({ lastTest: "chisq", lastResult: r }) : null;
      return { type: "chisq", data: r, summary, nextStep, targetCol, groupCol: catInputs[0] };
    }
    return { type: "unsupported", summary: "Select a numeric target with numeric/categorical inputs, or categorical target with categorical inputs." };
  }

  function AnalysisBuilderCenter({ rows, columns, cfg, theme }) {
    const result = cfg.builder && cfg.builder.result;
    const c = Charts.themeColors(), pal = Charts.palette();

    if (!result) {
      return (
        <React.Fragment>
          <div className="phead">
            <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
              <Icon name="bolt" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Analysis Builder
            </span>
          </div>
          <div className="empty">
            <Icon name="bolt" />
            <div className="t">Automated Analysis</div>
            <div className="s">Pick a <b>Target (Y)</b> and one or more <b>Input (X)</b> variables on the right, then click <b>Run Analysis</b>. The engine will select the appropriate statistical method and interpret the results.</div>
          </div>
        </React.Fragment>
      );
    }

    const { type, data, summary, nextStep, targetCol, numInputs, groupCol } = result;
    const summaryParts = summary.split("**");
    const fmtSummary = summaryParts.map((p, i) => i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>);

    let visual = null, statTable = null;

    if (type === "regression" && data) {
      const lo = Math.min(...data.terms.map((t) => t.coef)), hi = Math.max(...data.terms.map((t) => t.coef));
      const scatterData = rows.filter((r) => numInputs && numInputs.every((c2) => r[c2.key] != null) && r[targetCol.key] != null)
        .map((r) => { const ym = data.terms[0].coef + (numInputs || []).reduce((s, c2, i) => s + (data.terms[i + 1] ? data.terms[i + 1].coef * r[c2.key] : 0), 0); return [r[targetCol.key], ym]; });
      const scMin = Math.min(...scatterData.flat()), scMax = Math.max(...scatterData.flat());
      const scOpt = {
        ...Charts.baseGrid(c),
        grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
        tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item", formatter: (p) => `actual ${NODE.fmtCompact(p.value[0])}<br/>predicted ${NODE.fmtCompact(p.value[1])}` },
        xAxis: { type: "value", name: "actual", min: scMin, max: scMax, axisLabel: { color: c.text, fontSize: 9, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        yAxis: { type: "value", name: "predicted", min: scMin, max: scMax, axisLabel: { color: c.text, fontSize: 9, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
        series: [
          { type: "scatter", symbolSize: 5, data: scatterData, itemStyle: { color: pal[0], opacity: 0.55 },
            markLine: { silent: true, symbol: "none", lineStyle: { color: c.faint, type: "dashed" }, data: [[{ coord: [scMin, scMin] }, { coord: [scMax, scMax] }]] } },
        ],
      };
      visual = <div style={{ height: 200 }}><EChart option={scOpt} theme={theme} style={{ height: "100%" }} /></div>;
      statTable = (
        <table className="coef-table">
          <thead><tr><th>Term</th><th>Coefficient</th><th>Std Err</th><th>t</th><th>p-value</th><th></th></tr></thead>
          <tbody>{data.terms.map((t) => (
            <tr key={t.name}><td>{t.name}</td><td className="mono">{NODE.fmtNum(t.coef, 3)}</td><td className="mono">{NODE.fmtNum(t.se, 3)}</td>
              <td className="mono">{t.t.toFixed(2)}</td><td className="mono">{fmtP(t.p)}</td>
              <td><span className={"sig-tag " + (t.p < 0.05 ? "on" : "")}>{sigStars(t.p)}</span></td></tr>
          ))}</tbody>
        </table>
      );
    } else if (type === "anova" && data) {
      visual = <MeansBar means={data.means} theme={theme} />;
      statTable = <Verdict p={data.p} msg={`F(${data.df1}, ${data.df2}) = ${data.F.toFixed(2)}, p = ${fmtP(data.p)}, η² = ${data.eta2.toFixed(3)}.`} />;
    } else if (type === "chisq" && data) {
      statTable = <Verdict p={data.p} msg={`χ²(${data.df}) = ${data.chi.toFixed(2)}, p = ${fmtP(data.p)}, Cramér's V = ${data.V.toFixed(3)}.`} />;
    }

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
            <Icon name="bolt" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />Analysis Builder · {type === "regression" ? "OLS Regression" : type === "anova" ? "One-Way ANOVA" : type === "chisq" ? "Chi-Square" : "Result"}
          </span>
          {data && data.r2 != null && <span className="badge mono">R² = {data.r2.toFixed(3)}</span>}
          {data && data.F != null && !data.r2 && <span className="badge mono">F = {data.F.toFixed(2)}</span>}
        </div>
        <div className="pbody statsbody">
          {data && data.r2 != null && (
            <Cards items={[["R²", data.r2.toFixed(3)], ["Adj. R²", data.adj.toFixed(3)], ["F", data.F.toFixed(1)], ["p (model)", fmtP(data.pF)]]} />
          )}

          <div className="analysis-builder">
            <div className="ab-section">
              <div className="rs-label">Summary</div>
              <div className="ab-summary">{fmtSummary}</div>
            </div>
            {visual && <div className="ab-section"><div className="rs-label">Visual · Predicted vs Actual</div>{visual}</div>}
            {statTable && <div className="ab-section"><div className="rs-label">Statistical Results</div>{statTable}</div>}
            {nextStep && (
              <div className="ab-section">
                <div className="rs-label">Recommended Next Step</div>
                <NextStepPanel context={{ lastTest: "builder" }} />
              </div>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }

  // ---------- StatsCenter ----------
  function StatsCenter() {
    const activeId = useStore((s) => s.activeId);
    const theme = useStore((s) => s.theme);
    const cfgS = useStore((s) => s.ui.stats);
    const { rows, columns } = derive.getActiveData(activeId);
    const numCols = columns.filter((c) => c.type === "integer" || c.type === "float");
    const cfg = cfgS || defaultCfg(columns);
    const test = cfg.test;

    if (test === "distribution") return <DistributionCenter rows={rows} columns={columns} cfg={cfg} theme={theme} />;
    if (test === "builder") return <AnalysisBuilderCenter rows={rows} columns={columns} cfg={cfg} theme={theme} />;

    let body, title;
    if (test === "descriptive") {
      title = "Descriptive statistics";
      body = <DescTable rows={rows} cols={numCols} />;
    } else if (test === "corr") {
      title = `Correlation matrix · ${cfg.method === "spearman" ? "Spearman" : "Pearson"}`;
      const m = corrMatrix(rows, numCols, cfg.method);
      const summary = IE ? IE.summarizeCorrelation({ cols: numCols, matrix: m }) : "";
      body = (
        <React.Fragment>
          <CorrHeat cols={numCols} m={m} theme={theme} />
          <InterpretationPanel text={summary} icon="heatmap" />
          <NextStepPanel context={{ lastTest: "corr" }} />
        </React.Fragment>
      );
    } else if (test === "ttest") {
      const r = ttest(rows, cfg.measure, cfg.group, cfg.l1, cfg.l2);
      title = `Independent t-test · ${cfg.measure}`;
      body = (
        <React.Fragment>
          <Cards items={[["t", r.t.toFixed(3), sigStars(r.p)], ["df", r.df.toFixed(1)], ["p-value", fmtP(r.p)], ["Cohen's d", r.d.toFixed(2)]]} />
          <MeansBar means={{ [r.l1]: { mean: r.ma }, [r.l2]: { mean: r.mb } }} theme={theme} />
          <div className="grp-row"><span className="chip dim">{r.l1}</span> μ={NODE.fmtNum(r.ma, 1)} · σ={NODE.fmtNum(r.sa, 1)} · n={r.na}</div>
          <div className="grp-row"><span className="chip dim">{r.l2}</span> μ={NODE.fmtNum(r.mb, 1)} · σ={NODE.fmtNum(r.sb, 1)} · n={r.nb}</div>
          <Verdict p={r.p} msg={`The mean ${cfg.measure} of ${r.l1} (${NODE.fmtNum(r.ma, 0)}) ${r.p < 0.05 ? "differs significantly from" : "is not significantly different from"} that of ${r.l2} (${NODE.fmtNum(r.mb, 0)}). Effect size (Cohen's d) = ${r.d.toFixed(2)} — ${Math.abs(r.d) > 0.8 ? "large" : Math.abs(r.d) > 0.5 ? "medium" : Math.abs(r.d) > 0.2 ? "small" : "negligible"}.`} />
          <NextStepPanel context={{ lastTest: "ttest" }} />
        </React.Fragment>
      );
    } else if (test === "anova") {
      const r = anova(rows, cfg.measure, cfg.group);
      title = `One-way ANOVA · ${cfg.measure} by ${cfg.group}`;
      const top = Object.entries(r.means).sort((a, b) => b[1].mean - a[1].mean);
      body = (
        <React.Fragment>
          <Cards items={[["F", r.F.toFixed(2), sigStars(r.p)], ["df", `${r.df1}, ${r.df2}`], ["p-value", fmtP(r.p)], ["η²", r.eta2.toFixed(3)]]} />
          <MeansBar means={r.means} theme={theme} />
          <Verdict p={r.p} msg={`Mean ${cfg.measure} ${r.p < 0.05 ? "varies significantly" : "does not vary significantly"} across the ${r.k} ${cfg.group} groups (F=${r.F.toFixed(2)}). ${(r.eta2 * 100).toFixed(0)}% of variance explained by group (η²). Highest: ${top[0][0]} (${NODE.fmtNum(top[0][1].mean, 0)}), lowest: ${top[top.length - 1][0]} (${NODE.fmtNum(top[top.length - 1][1].mean, 0)}).`} />
          <NextStepPanel context={{ lastTest: "anova" }} />
        </React.Fragment>
      );
    } else if (test === "chisq") {
      const r = chisq(rows, cfg.a, cfg.b);
      title = `Chi-square test · ${cfg.a} × ${cfg.b}`;
      body = (
        <React.Fragment>
          <Cards items={[["χ²", r.chi.toFixed(2), sigStars(r.p)], ["df", r.df], ["p-value", fmtP(r.p)], ["Cramér's V", r.V.toFixed(3)]]} />
          <Contingency r={r} theme={theme} />
          <Verdict p={r.p} msg={`${cfg.a} and ${cfg.b} are ${r.p < 0.05 ? "significantly associated" : "statistically independent"} (χ²=${r.chi.toFixed(1)}, df=${r.df}). Association strength (Cramér's V) = ${r.V.toFixed(2)} — ${r.V > 0.3 ? "strong" : r.V > 0.1 ? "moderate" : "weak"}.`} />
          <NextStepPanel context={{ lastTest: "chisq" }} />
        </React.Fragment>
      );
    } else {
      const r = regression(rows, cfg.target, cfg.preds);
      title = `Linear regression · ${cfg.target} ~ ${cfg.preds.join(" + ")}`;
      const summary = IE ? IE.summarizeRegression(r) : "";
      body = (
        <React.Fragment>
          <Cards items={[["R²", r.r2.toFixed(3)], ["Adj. R²", r.adj.toFixed(3)], ["F", r.F.toFixed(1)], ["p (model)", fmtP(r.pF)]]} />
          <table className="coef-table">
            <thead><tr><th>Term</th><th>Coefficient</th><th>Std. Error</th><th>t</th><th>p-value</th><th></th></tr></thead>
            <tbody>{r.terms.map((t) => (
              <tr key={t.name}><td>{t.name}</td><td className="mono">{NODE.fmtNum(t.coef, 2)}</td><td className="mono">{NODE.fmtNum(t.se, 2)}</td>
                <td className="mono">{t.t.toFixed(2)}</td><td className="mono">{fmtP(t.p)}</td>
                <td><span className={"sig-tag " + (t.p < 0.05 ? "on" : "")}>{sigStars(t.p)}</span></td></tr>
            ))}</tbody>
          </table>
          <InterpretationPanel text={summary} icon="scatter" />
          <Verdict p={r.pF} msg={`The model explains ${(r.r2 * 100).toFixed(1)}% of variance in ${cfg.target} (adj. R²=${r.adj.toFixed(2)}). Significant predictors (p<0.05): ${r.terms.filter((t) => t.name !== "(Intercept)" && t.p < 0.05).map((t) => t.name).join(", ") || "none"}.`} />
          <NextStepPanel context={{ lastTest: "reg", lastResult: r }} />
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <div className="phead">
          <span className="ttl" style={{ textTransform: "none", fontSize: "var(--fs-13)", letterSpacing: 0, color: "var(--tx-hi)" }}>
            <Icon name="stats" size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent)" }} />{title}
          </span>
          <div className="spacer" />
          <span className="badge mono">α = 0.05</span>
        </div>
        <div className="pbody statsbody">{body}</div>
      </React.Fragment>
    );
  }

  // ---------- table components ----------
  function DescTable({ rows, cols }) {
    return (
      <table className="desc-table">
        <thead><tr><th>Variable</th><th>n</th><th>Mean</th><th>Median</th><th>Std</th><th>Min</th><th>Q1</th><th>Q3</th><th>Max</th><th>Skewness</th><th>Kurtosis</th></tr></thead>
        <tbody>{cols.map((c) => {
          const v = rows.map((r) => r[c.key]);
          const nx = num(v);
          const sk = SM.skewness ? SM.skewness(nx) : null;
          const ku = SM.kurtosis ? SM.kurtosis(nx) : null;
          const skStyle = sk != null && Math.abs(sk) > 1.5 ? { color: "var(--warn)", fontWeight: 600 } : {};
          return (
            <tr key={c.key}>
              <td className="dt-name">{c.label}</td>
              <td className="mono">{nx.length}</td>
              <td className="mono">{NODE.fmtNum(stat.mean(v), 1)}</td>
              <td className="mono">{NODE.fmtNum(stat.median(v), 1)}</td>
              <td className="mono">{NODE.fmtNum(stat.std(v), 1)}</td>
              <td className="mono">{NODE.fmtNum(stat.min(v), 0)}</td>
              <td className="mono">{NODE.fmtNum(stat.quantile(v, .25), 0)}</td>
              <td className="mono">{NODE.fmtNum(stat.quantile(v, .75), 0)}</td>
              <td className="mono">{NODE.fmtNum(stat.max(v), 0)}</td>
              <td className="mono" style={skStyle}>{sk != null ? sk.toFixed(2) : "—"}</td>
              <td className="mono">{ku != null ? ku.toFixed(2) : "—"}</td>
            </tr>
          );
        })}</tbody>
      </table>
    );
  }

  function CorrHeat({ cols, m, theme }) {
    const c = Charts.themeColors(), pal = Charts.palette();
    const data = []; m.forEach((row, i) => row.forEach((v, j) => data.push([j, i, v == null ? "-" : +v.toFixed(2)])));
    const labels = cols.map((x) => x.label);
    const option = { animation: false, grid: { left: 8, right: 20, top: 10, bottom: 90, containLabel: true },
      tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "item", formatter: (p) => `${labels[p.value[1]]} × ${labels[p.value[0]]}<br/>r = <b>${p.value[2]}</b>` },
      xAxis: { type: "category", data: labels, axisLabel: { color: c.text, fontSize: 9, rotate: 40 } },
      yAxis: { type: "category", data: labels, axisLabel: { color: c.text, fontSize: 9 } },
      visualMap: { min: -1, max: 1, calculable: true, orient: "horizontal", left: "center", bottom: 0, itemWidth: 14, itemHeight: 90,
        inRange: { color: [pal[1], Charts.resolveVar("--bg-2"), pal[0]] }, textStyle: { color: c.text, fontSize: 10 } },
      series: [{ type: "heatmap", data, label: { show: true, color: c.textHi, fontSize: 9, fontFamily: "IBM Plex Mono" }, itemStyle: { borderColor: c.bg, borderWidth: 1 } }] };
    return <div style={{ height: 340 }}><EChart option={option} theme={theme} style={{ height: "100%" }} /></div>;
  }

  function Contingency({ r, theme }) {
    return (
      <table className="cont-table">
        <thead><tr><th></th>{r.bL.map((b) => <th key={b}>{b}</th>)}<th>Σ</th></tr></thead>
        <tbody>{r.aL.map((a, i) => (
          <tr key={a}><td className="dt-name">{a}</td>{r.O[i].map((o, j) => {
            const e = r.E[i][j], dev = (o - e) / e;
            return <td key={j} className="mono cont-cell" style={{ background: `color-mix(in oklch, var(--accent) ${Math.min(40, Math.abs(dev) * 60)}%, transparent)` }}>{o}<span className="cont-e">{e.toFixed(0)}</span></td>;
          })}<td className="mono">{r.O[i].reduce((s, v) => s + v, 0)}</td></tr>
        ))}</tbody>
      </table>
    );
  }

  // ---------- right config panel ----------
  function defaultCfg(columns) {
    const cats = columns.filter((c) => c.type === "category");
    const nums = columns.filter((c) => c.type === "integer" || c.type === "float");
    return {
      test: "corr", method: "pearson",
      measure: "price_per_m2", group: cats[1] ? cats[1].key : (cats[0] ? cats[0].key : ""),
      l1: "아파트", l2: "오피스텔",
      a: cats[0] ? cats[0].key : "", b: cats[1] ? cats[1].key : (cats[0] ? cats[0].key : ""),
      target: "price_manwon", preds: ["area_m2", "floor", "built_year"],
      distCol: nums[0] ? nums[0].key : "",
      builder: { target: "price_manwon", inputs: ["area_m2", "floor", "built_year"], result: null },
    };
  }

  function StatsPanel() {
    const activeId = useStore((s) => s.activeId);
    const cfgS = useStore((s) => s.ui.stats);
    const { columns, rows } = derive.getActiveData(activeId);
    const cfg = cfgS || defaultCfg(columns);
    const set = (patch) => actions.setUI({ stats: { ...cfg, ...patch } });
    const numCols = columns.filter((c) => c.type === "integer" || c.type === "float");
    const catCols = columns.filter((c) => c.type === "category");
    const levels = (key) => [...new Set(rows.map((r) => String(r[key])))];

    const bld = cfg.builder || { target: numCols[0] ? numCols[0].key : "", inputs: [], result: null };
    const setBld = (patch) => set({ builder: { ...bld, ...patch, result: null } });

    const runBuilder2 = () => {
      const result = runBuilder(rows, columns, bld.target, bld.inputs);
      set({ builder: { ...bld, result }, test: "builder" });
    };

    return (
      <div className="statspanel">
        <div className="cp-block">
          <div className="cp-blocktitle">Analysis</div>
          <div className="test-list">
            {TESTS.map((t) => (
              <button key={t.k} className={"test-item" + (cfg.test === t.k ? " on" : "")} onClick={() => set({ test: t.k })}>
                <Icon name={t.icon} size={14} /><span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {cfg.test === "distribution" && (
          <Picker label="Column" value={cfg.distCol || (numCols[0] && numCols[0].key)} opts={numCols} onChange={(v) => set({ distCol: v })} />
        )}
        {cfg.test === "corr" && (
          <div className="cp-block"><div className="cp-blocktitle">Method</div>
            <div className="seg" style={{ width: "100%" }}>{["pearson", "spearman"].map((mth) => <button key={mth} className={cfg.method === mth ? "on" : ""} style={{ flex: 1, textTransform: "capitalize" }} onClick={() => set({ method: mth })}>{mth}</button>)}</div></div>
        )}
        {(cfg.test === "ttest" || cfg.test === "anova") && (
          <React.Fragment>
            <Picker label="Measure" value={cfg.measure} opts={numCols} onChange={(v) => set({ measure: v })} />
            <Picker label="Group by" value={cfg.group} opts={catCols} onChange={(v) => set({ group: v })} />
          </React.Fragment>
        )}
        {cfg.test === "ttest" && (
          <div className="cp-block"><div className="cp-blocktitle">Compare groups</div>
            <select className="sel" style={{ width: "100%", marginBottom: 6 }} value={cfg.l1} onChange={(e) => set({ l1: e.target.value })}>{levels(cfg.group).map((l) => <option key={l}>{l}</option>)}</select>
            <select className="sel" style={{ width: "100%" }} value={cfg.l2} onChange={(e) => set({ l2: e.target.value })}>{levels(cfg.group).map((l) => <option key={l}>{l}</option>)}</select>
          </div>
        )}
        {cfg.test === "chisq" && (
          <React.Fragment>
            <Picker label="Variable A" value={cfg.a} opts={catCols} onChange={(v) => set({ a: v })} />
            <Picker label="Variable B" value={cfg.b} opts={catCols} onChange={(v) => set({ b: v })} />
          </React.Fragment>
        )}
        {cfg.test === "reg" && (
          <React.Fragment>
            <Picker label="Dependent (Y)" value={cfg.target} opts={numCols} onChange={(v) => set({ target: v })} />
            <div className="cp-block"><div className="cp-blocktitle">Predictors (X)</div>
              <div className="ml-feats">{numCols.filter((c) => c.key !== cfg.target).map((c) => { const on = cfg.preds.includes(c.key); return (
                <div key={c.key} className="ml-feat" onClick={() => set({ preds: on ? cfg.preds.filter((f) => f !== c.key) : [...cfg.preds, c.key] })}>
                  <span className={"checkbox" + (on ? " on" : "")}>{on && <Icon name="check" size={11} />}</span>{c.label}
                </div>
              ); })}</div></div>
          </React.Fragment>
        )}
        {cfg.test === "builder" && (
          <React.Fragment>
            <Picker label="Target Y" value={bld.target} opts={columns.filter((c) => c.type !== "datetime")} onChange={(v) => setBld({ target: v })} />
            <div className="cp-block"><div className="cp-blocktitle">Input X (multi-select)</div>
              <div className="ml-feats">{columns.filter((c) => c.key !== bld.target && c.type !== "datetime" && c.type !== "string").map((c) => {
                const on = bld.inputs.includes(c.key);
                return (
                  <div key={c.key} className="ml-feat" onClick={() => setBld({ inputs: on ? bld.inputs.filter((k) => k !== c.key) : [...bld.inputs, c.key] })}>
                    <span className={"checkbox" + (on ? " on" : "")}>{on && <Icon name="check" size={11} />}</span>
                    <span style={{ color: c.role === "measure" ? "var(--meas-color)" : "var(--dim-color)", fontSize: "var(--fs-11)" }}>{c.label}</span>
                  </div>
                );
              })}</div></div>
            <button className="btn primary" style={{ width: "100%", height: 32 }} onClick={runBuilder2} disabled={!bld.inputs.length}>
              <Icon name="play" size={13} /> Run Analysis
            </button>
          </React.Fragment>
        )}

        <div className="cf-info"><Icon name="bolt" size={14} /><div>Exact p-values (incomplete beta/gamma). Auto-interpretation via Insight Engine at α = 0.05.</div></div>
      </div>
    );
  }

  function Picker({ label, value, opts, onChange }) {
    return <div className="cp-block"><div className="cp-blocktitle">{label}</div>
      <select className="sel" style={{ width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>{opts.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>;
  }

  window.StatsMode = function () {
    return <window.Workspace left={<window.DatasetTree />} leftTitle="Data Explorer"
      center={<StatsCenter />} right={<StatsPanel />} rightTitle="Test Setup" />;
  };
})();
