/* NØDE — AI Analytics Assistant + Insight Engine (real, data-derived) */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE;
  const IE = window.IE;

  function buildInsights(rows) {
    const out = [];
    const n = rows.length;
    const byD = {}; for (const r of rows) byD[r.district] = (byD[r.district] || 0) + 1;
    const dArr = Object.entries(byD).sort((a, b) => b[1] - a[1]);
    if (dArr.length) {
      const [topD, topC] = dArr[0];
      out.push({ icon: "map", text: `**${topD}** accounts for **${(topC / n * 100).toFixed(0)}%** of all transactions (${topC} of ${n}).` });
      const top3 = dArr.slice(0, 3).reduce((s, x) => s + x[1], 0);
      out.push({ icon: "kpi", text: `Top 3 districts make up **${(top3 / n * 100).toFixed(0)}%** of market activity — a concentrated market.` });
    }
    const priceByD = {}; for (const r of rows) { (priceByD[r.district] = priceByD[r.district] || []).push(r.price_manwon); }
    const avgD = Object.entries(priceByD).map(([d, a]) => [d, stat.mean(a)]).sort((a, b) => b[1] - a[1]);
    if (avgD.length) out.push({ icon: "trend", text: `**${avgD[0][0]}** has the highest average price at **${NODE.fmtWon(avgD[0][1])}**, ${(avgD[0][1] / avgD[avgD.length - 1][1]).toFixed(1)}× that of ${avgD[avgD.length - 1][0]}.` });
    const ppmBy = {}; for (const r of rows) { const y = r.txn_date.slice(0, 4); if (r.price_per_m2) (ppmBy[y] = ppmBy[y] || []).push(r.price_per_m2); }
    if (ppmBy["2022"] && ppmBy["2024"]) {
      const g = (stat.mean(ppmBy["2024"]) / stat.mean(ppmBy["2022"]) - 1) * 100;
      out.push({ icon: "line", text: `Average ₩/m² ${g >= 0 ? "rose" : "fell"} **${Math.abs(g).toFixed(1)}%** from 2022 to 2024, after a mid-period dip.` });
    }
    const byT = {}; for (const r of rows) { if (r.price_per_m2) (byT[r.building_type] = byT[r.building_type] || []).push(r.price_per_m2); }
    const tArr = Object.entries(byT).map(([t, a]) => [t, stat.mean(a)]).sort((a, b) => b[1] - a[1]);
    if (tArr.length > 1) out.push({ icon: "treemap", text: `**${tArr[0][0]}** commands the highest ₩/m² (${NODE.fmtNum(tArr[0][1], 0)}만), a ${((tArr[0][1] / tArr[tArr.length - 1][1] - 1) * 100).toFixed(0)}% premium over ${tArr[tArr.length - 1][0]}.` });
    const cs = derive.colStats(rows, "price_per_m2"); const iqr = cs.q3 - cs.q1, hi = cs.q3 + 1.5 * iqr;
    const outl = rows.filter((r) => r.price_per_m2 > hi).length;
    if (outl) out.push({ icon: "filter", text: `**${outl}** transactions are statistical outliers on ₩/m² — worth review in Cleaning Studio.` });
    return out;
  }

  const SUGGEST = [
    { q: "Average price by district", k: "district" },
    { q: "Top 10 complexes by price", k: "complex" },
    { q: "Mix by building type", k: "type" },
    { q: "Find outliers in the data", k: "outlier" },
    { q: "Price trend over time", k: "trend" },
    { q: "Summarize last analysis", k: "last" },
  ];

  function interpret(text) {
    const t = text.toLowerCase();
    if (/(outlier|이상치|anomal)/.test(t)) return { kind: "outlier" };
    if (/(complex|단지|top|상위)/.test(t)) return { kind: "complex" };
    if (/(type|유형|building|mix)/.test(t)) return { kind: "type" };
    if (/(trend|추세|time|month|월|시계열|over)/.test(t)) return { kind: "trend" };
    if (/(district|지역|구별|region|area)/.test(t)) return { kind: "district" };
    if (/(last|recent|previous|summary|방금|마지막|결과)/.test(t)) return { kind: "last" };
    if (/(corr|상관|correlation)/.test(t)) return { kind: "goStats", tab: "corr" };
    if (/(regress|회귀|regression)/.test(t)) return { kind: "goStats", tab: "reg" };
    if (/(distribut|분포|histogram|boxplot)/.test(t)) return { kind: "goStats", tab: "distribution" };
    if (/(ml|machine|learn|분류|cluster|군집)/.test(t)) return { kind: "goMl" };
    return { kind: "district" };
  }

  function runIntent(kind, tab) {
    const a = actions;
    if (kind === "outlier") {
      a.setMode("clean");
      return { text: "Opened the **Cleaning Studio** and flagged ₩/m² outliers via the IQR method. Use *Remove outliers* to drop them." };
    }
    if (kind === "trend") {
      a.setActive("monthly_index"); a.setMode("visualize");
      a.setViz({ type: "line", cols: [{ key: "month", label: "month", role: "dimension", type: "datetime" }],
        rows: [{ key: "avg_price_per_m2", label: "avg_price_per_m2", role: "measure", type: "float", agg: "avg", id: "avg_price_per_m2_avg" }], color: null, sortDesc: false, topN: 0 });
      return { text: "Built a **line chart** of average ₩/m² by month — the rise–dip–recovery cycle is visible." };
    }
    if (kind === "last") {
      const last = window.NODE.lastAnalysisResult;
      if (!last) return { text: "No recent analysis found. Run a test in **Stats Studio** or train a model in **ML Studio** first." };
      const summary = last.type === "ml"
        ? `Last ML run: **${last.task}** on ${last.target || "features"} — score: **${last.score}**.`
        : `Last analysis: **${last.summary || "no summary available"}**`;
      return { text: summary };
    }
    if (kind === "goStats") {
      a.setMode("stats");
      a.setUI({ stats: { test: tab || "corr" } });
      return { text: `Switched to **Stats Studio** → ${tab || "Correlation"} tab.` };
    }
    if (kind === "goMl") {
      a.setMode("ml");
      return { text: "Switched to **ML Studio**. Pick a task and features on the right, then click Train." };
    }
    a.setActive("seoul_txns"); a.setMode("visualize");
    if (kind === "type") {
      a.setViz({ type: "pie", cols: [{ key: "building_type", label: "building_type", role: "dimension", type: "category" }],
        rows: [{ key: "id", label: "id", role: "measure", type: "integer", agg: "count", id: "id_count" }], color: null, sortDesc: true, topN: 0 });
      return { text: "Built a **donut chart** of transaction mix by building type." };
    }
    if (kind === "complex") {
      a.setViz({ type: "hbar", cols: [{ key: "complex_name", label: "complex_name", role: "dimension", type: "category" }],
        rows: [{ key: "price_manwon", label: "price_manwon", role: "measure", type: "integer", agg: "avg", id: "price_manwon_avg" }], color: null, sortDesc: true, topN: 10 });
      return { text: "Built a **Top 10 horizontal bar** of complexes by average price." };
    }
    a.setViz({ type: "bar", cols: [{ key: "district", label: "district", role: "dimension", type: "category" }],
      rows: [{ key: "price_manwon", label: "price_manwon", role: "measure", type: "integer", agg: "avg", id: "price_manwon_avg" }], color: null, sortDesc: true, topN: 0 });
    return { text: "Built a **bar chart** of average price by district, sorted high to low." };
  }

  function fmtMd(s) {
    return s.split("**").map((part, i) => i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>);
  }

  function AIDrawer() {
    const open = useStore((s) => s.ui.aiOpen);
    const activeId = useStore((s) => s.activeId);
    const { rows } = derive.getActiveData("seoul_txns");
    const [log, setLog] = React.useState([]);
    const [input, setInput] = React.useState("");
    const insights = React.useMemo(() => buildInsights(rows), [rows]);

    // Auto-profile using Insight Engine
    const profile = React.useMemo(() => {
      if (!IE) return [];
      try { return IE.profileDataset(activeId); } catch (_) { return []; }
    }, [activeId]);

    const bodyRef = React.useRef(null);
    React.useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [log]);

    if (!open) return null;
    const send = (q) => {
      if (!q.trim()) return;
      const intent = interpret(q);
      window.LOG && window.LOG.info('ai', 'Ask Insight query', { q: q.trim(), intent: intent.kind });
      const res = runIntent(intent.kind, intent.tab);
      setLog((l) => [...l, { role: "user", text: q }, { role: "ai", text: res.text }]);
      setInput("");
    };

    return ReactDOM.createPortal(
      <div className="aidrawer fade">
        <div className="ai-head">
          <span className="ai-spark"><Icon name="ai" size={15} /></span>
          <div><div className="ai-title">Ask Insight</div><div className="ai-sub">AI analytics assistant · local</div></div>
          <div style={{ flex: 1 }} />
          <button className="iconbtn" onClick={() => actions.setUI({ aiOpen: false })}><Icon name="x" size={15} /></button>
        </div>

        <div className="ai-body" ref={bodyRef}>
          {/* Insight Engine auto-profile */}
          {profile.length > 0 && (
            <React.Fragment>
              <div className="ai-section-h"><Icon name="bolt" size={11} style={{ marginRight: 4 }} />Dataset Profile · {activeId}</div>
              {profile.map((text, i) => (
                <div className="insight" key={"prof-" + i}>
                  <span className="insight-ic"><Icon name="stats" size={13} /></span>
                  <div className="insight-tx">{fmtMd(text)}</div>
                </div>
              ))}
            </React.Fragment>
          )}

          {/* Last analysis result summary */}
          {window.NODE && window.NODE.lastAnalysisResult && (
            <React.Fragment>
              <div className="ai-section-h" style={{ marginTop: 12 }}><Icon name="ml" size={11} style={{ marginRight: 4 }} />Last Analysis Result</div>
              <div className="insight">
                <span className="insight-ic"><Icon name="scatter" size={13} /></span>
                <div className="insight-tx">{fmtMd(
                  window.NODE.lastAnalysisResult.type === "ml"
                    ? `ML · **${window.NODE.lastAnalysisResult.task}** on ${window.NODE.lastAnalysisResult.target || "features"} — score: **${window.NODE.lastAnalysisResult.score}**`
                    : (window.NODE.lastAnalysisResult.summary || "Analysis complete")
                )}</div>
              </div>
            </React.Fragment>
          )}

          {/* Market insights */}
          <div className="ai-section-h" style={{ marginTop: 12 }}>Market Insights · {rows.length} rows</div>
          {insights.map((ins, i) => (
            <div className="insight" key={i}>
              <span className="insight-ic"><Icon name={ins.icon} size={13} /></span>
              <div className="insight-tx">{fmtMd(ins.text)}</div>
            </div>
          ))}

          {log.length > 0 && <div className="ai-section-h" style={{ marginTop: 14 }}>Conversation</div>}
          {log.map((m, i) => (
            <div key={i} className={"ai-msg " + m.role}>
              {m.role === "ai" && <span className="insight-ic"><Icon name="ai" size={12} /></span>}
              <div className="ai-bubble">{fmtMd(m.text)}</div>
            </div>
          ))}
        </div>

        <div className="ai-suggest">
          {SUGGEST.map((s) => <button key={s.k} className="ai-chip" onClick={() => send(s.q)}>{s.q}</button>)}
        </div>
        <div className="ai-input">
          <input className="inp" placeholder="Ask anything about this data…" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} />
          <button className="btn primary sm" onClick={() => send(input)}><Icon name="play" size={12} /></button>
        </div>
      </div>,
      document.body
    );
  }

  window.AIDrawer = AIDrawer;
})();
