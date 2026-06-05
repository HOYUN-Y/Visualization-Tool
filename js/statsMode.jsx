/* NØDE/Insight — Statistical Analysis Studio: significance testing + auto-interpretation */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE, Charts = window.Charts, SM = window.SM;
  const EChart = Charts.EChart;
  const num = (a) => a.filter((v) => v != null && v !== "" && !isNaN(v)).map(Number);

  const TESTS = [
    { k: "descriptive", label: "Descriptive", icon: "stats" },
    { k: "corr", label: "Correlation", icon: "heatmap" },
    { k: "ttest", label: "T-Test", icon: "kpi" },
    { k: "anova", label: "ANOVA", icon: "bar" },
    { k: "chisq", label: "Chi-Square", icon: "treemap" },
    { k: "reg", label: "Regression", icon: "scatter" },
  ];
  const sigStars = (p) => p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "n.s.";
  const fmtP = (p) => p < 0.0001 ? "< 0.0001" : p.toFixed(4);

  // ---------- tests ----------
  function rank(arr) { const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(arr.length); idx.forEach(([_, i], k) => r[i] = k + 1); return r; }

  function corrMatrix(rows, cols, method) {
    const series = cols.map((c) => { const v = rows.map((r) => r[c.key]); return method === "spearman" ? rank(num(v)) : num(v); });
    // align by index using rows where all present
    const data = cols.map((c) => rows.map((r) => r[c.key]));
    const m = cols.map(() => cols.map(() => 0));
    for (let i = 0; i < cols.length; i++) for (let j = 0; j < cols.length; j++) {
      let xi = data[i], xj = data[j];
      if (method === "spearman") { const idx = xi.map((_, k) => k).filter((k) => xi[k] != null && xj[k] != null); const rx = rank(idx.map((k) => xi[k])), ry = rank(idx.map((k) => xj[k])); m[i][j] = stat.pearson(rx, ry); }
      else m[i][j] = stat.pearson(xi, xj);
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
    const groups = {}; for (const r of rows) { const g = r[group], v = r[measure]; if (v != null && !isNaN(v)) (groups[g] = groups[g] || []).push(+v); }
    const keys = Object.keys(groups); const all = keys.flatMap((k) => groups[k]); const grand = stat.mean(all); const N = all.length, k = keys.length;
    let ssb = 0, ssw = 0; const means = {};
    for (const key of keys) { const g = groups[key]; const mg = stat.mean(g); means[key] = { mean: mg, n: g.length, sd: stat.std(g) }; ssb += g.length * (mg - grand) ** 2; for (const x of g) ssw += (x - mg) ** 2; }
    const df1 = k - 1, df2 = N - k, msb = ssb / df1, msw = ssw / df2, F = msb / msw, p = SM.fP(F, df1, df2), eta2 = ssb / (ssb + ssw);
    return { means, F, df1, df2, p, eta2, k, N };
  }

  function chisq(rows, A, B) {
    const aL = [...new Set(rows.map((r) => r[A]))], bL = [...new Set(rows.map((r) => r[B]))];
    const O = aL.map(() => bL.map(() => 0)); let N = 0;
    for (const r of rows) { const i = aL.indexOf(r[A]), j = bL.indexOf(r[B]); if (i >= 0 && j >= 0) { O[i][j]++; N++; } }
    const rowT = O.map((r) => r.reduce((s, v) => s + v, 0)), colT = bL.map((_, j) => O.reduce((s, r) => s + r[j], 0));
    let chi = 0; const E = O.map((r, i) => r.map((o, j) => { const e = rowT[i] * colT[j] / N; chi += (o - e) ** 2 / e; return e; }));
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
    const Ainv = SM.matInverse(A); const coef = Ainv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const pred = (r) => coef.reduce((s, c, j) => s + c * (j === 0 ? 1 : +r[preds[j - 1]]), 0);
    const ym = stat.mean(y); let rss = 0, tss = 0; for (let i = 0; i < n; i++) { rss += (y[i] - pred(data[i])) ** 2; tss += (y[i] - ym) ** 2; }
    const df = n - p, sigma2 = rss / df;
    const terms = ["(Intercept)", ...preds].map((name, j) => { const se = Math.sqrt(sigma2 * Ainv[j][j]); const t = coef[j] / se; return { name, coef: coef[j], se, t, p: SM.tP(t, df) }; });
    const r2 = 1 - rss / tss, adj = 1 - (1 - r2) * (n - 1) / df, F = (tss - rss) / (p - 1) / (rss / df), pF = SM.fP(F, p - 1, df);
    return { terms, r2, adj, F, df1: p - 1, df2: df, pF, n, target };
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
    return <div className="stat-cards">{items.map(([l, v, sub]) => <div className="stat-card" key={l}><div className="sc-val mono">{v}</div><div className="sc-lbl">{l}{sub ? <span className="sc-sub"> {sub}</span> : ""}</div></div>)}</div>;
  }
  function MeansBar({ means, theme, unit }) {
    const c = Charts.themeColors(), pal = Charts.palette();
    const keys = Object.keys(means); const data = keys.map((k) => means[k].mean);
    const option = { ...Charts.baseGrid(c), grid: { left: 8, right: 14, top: 16, bottom: keys.length > 6 ? 50 : 24, containLabel: true },
      tooltip: { ...Charts.baseGrid(c).tooltip, trigger: "axis" },
      xAxis: { type: "category", data: keys, axisLabel: { color: c.text, fontSize: 10, rotate: keys.length > 6 ? 32 : 0, interval: 0 }, axisLine: { lineStyle: { color: c.axis } } },
      yAxis: { type: "value", axisLabel: { color: c.text, fontSize: 10, formatter: NODE.fmtCompact }, splitLine: { lineStyle: { color: c.split } } },
      series: [{ type: "bar", data: data.map((v, i) => ({ value: v, itemStyle: { color: pal[i % 8], borderRadius: [3, 3, 0, 0] } })), barMaxWidth: 46 }] };
    return <div style={{ height: 200 }}><EChart option={option} theme={theme} style={{ height: "100%" }} /></div>;
  }

  // ---------- center ----------
  function StatsCenter() {
    const activeId = useStore((s) => s.activeId);
    const theme = useStore((s) => s.theme);
    const cfgS = useStore((s) => s.ui.stats);
    const { rows, columns } = derive.getActiveData(activeId);
    const numCols = columns.filter((c) => c.type === "integer" || c.type === "float");
    const cfg = cfgS || defaultCfg(columns);
    const test = cfg.test;

    let body, title;
    if (test === "descriptive") {
      title = "Descriptive statistics";
      body = <DescTable rows={rows} cols={numCols} />;
    } else if (test === "corr") {
      title = `Correlation matrix · ${cfg.method === "spearman" ? "Spearman" : "Pearson"}`;
      const m = corrMatrix(rows, numCols, cfg.method);
      body = <CorrHeat cols={numCols} m={m} theme={theme} />;
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
          <Verdict p={r.p} msg={`Mean ${cfg.measure} ${r.p < 0.05 ? "varies significantly" : "does not vary significantly"} across the ${r.k} ${cfg.group} groups (F=${r.F.toFixed(2)}). ${(r.eta2 * 100).toFixed(0)}% of the variance is explained by group (η²). Highest: ${top[0][0]} (${NODE.fmtNum(top[0][1].mean, 0)}), lowest: ${top[top.length - 1][0]} (${NODE.fmtNum(top[top.length - 1][1].mean, 0)}).`} />
        </React.Fragment>
      );
    } else if (test === "chisq") {
      const r = chisq(rows, cfg.a, cfg.b);
      title = `Chi-square test of independence · ${cfg.a} × ${cfg.b}`;
      body = (
        <React.Fragment>
          <Cards items={[["χ²", r.chi.toFixed(2), sigStars(r.p)], ["df", r.df], ["p-value", fmtP(r.p)], ["Cramér's V", r.V.toFixed(3)]]} />
          <Contingency r={r} theme={theme} />
          <Verdict p={r.p} msg={`${cfg.a} and ${cfg.b} are ${r.p < 0.05 ? "significantly associated" : "statistically independent"} (χ²=${r.chi.toFixed(1)}, df=${r.df}). Association strength (Cramér's V) = ${r.V.toFixed(2)} — ${r.V > 0.3 ? "strong" : r.V > 0.1 ? "moderate" : "weak"}.`} />
        </React.Fragment>
      );
    } else {
      const r = regression(rows, cfg.target, cfg.preds);
      title = `Linear regression · ${cfg.target} ~ ${cfg.preds.join(" + ")}`;
      body = (
        <React.Fragment>
          <Cards items={[["R²", r.r2.toFixed(3)], ["Adj. R²", r.adj.toFixed(3)], ["F", r.F.toFixed(1)], ["p (model)", fmtP(r.pF)]]} />
          <table className="coef-table">
            <thead><tr><th>Term</th><th>Coefficient</th><th>Std. Error</th><th>t</th><th>p-value</th><th></th></tr></thead>
            <tbody>{r.terms.map((t) => (
              <tr key={t.name}><td>{t.name}</td><td className="mono">{NODE.fmtNum(t.coef, 2)}</td><td className="mono">{NODE.fmtNum(t.se, 2)}</td>
                <td className="mono">{t.t.toFixed(2)}</td><td className="mono">{fmtP(t.p)}</td><td><span className={"sig-tag " + (t.p < 0.05 ? "on" : "")}>{sigStars(t.p)}</span></td></tr>
            ))}</tbody>
          </table>
          <Verdict p={r.pF} msg={`The model explains ${(r.r2 * 100).toFixed(1)}% of variance in ${cfg.target} (adj. R²=${r.adj.toFixed(2)}). Significant predictors (p<0.05): ${r.terms.filter((t) => t.name !== "(Intercept)" && t.p < 0.05).map((t) => t.name).join(", ") || "none"}.`} />
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

  function DescTable({ rows, cols }) {
    return (
      <table className="desc-table">
        <thead><tr><th>Variable</th><th>n</th><th>Mean</th><th>Median</th><th>Std</th><th>Min</th><th>Q1</th><th>Q3</th><th>Max</th></tr></thead>
        <tbody>{cols.map((c) => { const v = rows.map((r) => r[c.key]); return (
          <tr key={c.key}><td className="dt-name">{c.label}</td><td className="mono">{num(v).length}</td>
            <td className="mono">{NODE.fmtNum(stat.mean(v), 1)}</td><td className="mono">{NODE.fmtNum(stat.median(v), 1)}</td>
            <td className="mono">{NODE.fmtNum(stat.std(v), 1)}</td><td className="mono">{NODE.fmtNum(stat.min(v), 0)}</td>
            <td className="mono">{NODE.fmtNum(stat.quantile(v, .25), 0)}</td><td className="mono">{NODE.fmtNum(stat.quantile(v, .75), 0)}</td>
            <td className="mono">{NODE.fmtNum(stat.max(v), 0)}</td></tr>
        ); })}</tbody>
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
    return <div style={{ height: 380 }}><EChart option={option} theme={theme} style={{ height: "100%" }} /></div>;
  }

  function Contingency({ r, theme }) {
    return (
      <table className="cont-table">
        <thead><tr><th></th>{r.bL.map((b) => <th key={b}>{b}</th>)}<th>Σ</th></tr></thead>
        <tbody>{r.aL.map((a, i) => (
          <tr key={a}><td className="dt-name">{a}</td>{r.O[i].map((o, j) => {
            const e = r.E[i][j]; const dev = (o - e) / e;
            return <td key={j} className="mono cont-cell" style={{ background: `color-mix(in oklch, var(--accent) ${Math.min(40, Math.abs(dev) * 60)}%, transparent)` }}>{o}<span className="cont-e">{e.toFixed(0)}</span></td>;
          })}<td className="mono">{r.O[i].reduce((s, v) => s + v, 0)}</td></tr>
        ))}</tbody>
      </table>
    );
  }

  // ---------- right config ----------
  function defaultCfg(columns) {
    const cats = columns.filter((c) => c.type === "category");
    return { test: "corr", method: "pearson", measure: "price_per_m2", group: cats[1] ? cats[1].key : cats[0].key,
      l1: "아파트", l2: "오피스텔", a: cats[0].key, b: cats[1] ? cats[1].key : cats[0].key,
      target: "price_manwon", preds: ["area_m2", "floor", "built_year"] };
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
                <div key={c.key} className="ml-feat" onClick={() => set({ preds: on ? cfg.preds.filter((f) => f !== c.key) : [...cfg.preds, c.key] })}><span className={"checkbox" + (on ? " on" : "")}>{on && <Icon name="check" size={11} />}</span>{c.label}</div>
              ); })}</div></div>
          </React.Fragment>
        )}

        <div className="cf-info"><Icon name="bolt" size={14} /><div>Tests run locally with exact p-values (incomplete beta / gamma). Auto-interpretation summarizes the result at α = 0.05.</div></div>
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
