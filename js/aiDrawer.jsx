/* NØDE — Ask Insight: schema-agnostic analytics assistant (works on any dataset) */
(function () {
  const { useStore, actions, derive, stat } = window.Store;
  const Icon = window.Icon, NODE = window.NODE;
  const IE = window.IE;

  // ---- column helpers (generic, any dataset) ----
  const dimsOf = (cols) => cols.filter((c) => c.role === "dimension" && (c.type === "category" || c.type === "string"));
  const measOf = (cols) => cols.filter((c) => c.role === "measure");
  const dateOf = (cols) => cols.find((c) => c.type === "datetime");
  const cardinality = (rows, key) => { const s = new Set(); for (const r of rows) { s.add(r[key]); if (s.size > 300) break; } return s.size; };
  // Prefer a low-cardinality dimension for grouping / pie (2–50 distinct); fallback to first.
  const lowCardDim = (rows, dims) => {
    const ranked = dims.map((d) => [d, cardinality(rows, d.key)]).filter(([, n]) => n >= 2 && n <= 50).sort((a, b) => a[1] - b[1]);
    return (ranked[0] && ranked[0][0]) || dims[0] || null;
  };

  // ---- data-derived insights from the ACTIVE dataset ----
  function buildInsights(rows, columns) {
    const out = [];
    const n = rows.length;
    if (!n || !columns.length) return out;
    const dims = dimsOf(columns), meas = measOf(columns), dt = dateOf(columns);
    out.push({ icon: "kpi", text: `이 데이터셋은 **${n.toLocaleString()}행** · 측정값 **${meas.length}개** · 차원 **${dims.length}개** 입니다.` });

    const d0 = lowCardDim(rows, dims);
    if (d0) {
      const by = {}; for (const r of rows) { const k = r[d0.key]; if (k != null && k !== "") by[k] = (by[k] || 0) + 1; }
      const arr = Object.entries(by).sort((a, b) => b[1] - a[1]);
      if (arr.length) out.push({ icon: "layers", text: `**${d0.label}** 중 **${arr[0][0]}**가 전체의 **${(arr[0][1] / n * 100).toFixed(0)}%**(${arr[0][1]}행)로 최다입니다.` });
      const m0 = meas[0];
      if (m0 && arr.length > 1) {
        const mby = {}; for (const r of rows) { const k = r[d0.key], v = r[m0.key]; if (k != null && v != null && !isNaN(v)) (mby[k] = mby[k] || []).push(+v); }
        const avg = Object.entries(mby).map(([k, a]) => [k, stat.mean(a)]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
        if (avg.length > 1 && avg[avg.length - 1][1]) out.push({ icon: "trend", text: `평균 **${m0.label}**는 **${avg[0][0]}**(${NODE.fmtCompact(avg[0][1])})가 가장 높아 **${avg[avg.length - 1][0]}**의 ${(avg[0][1] / avg[avg.length - 1][1]).toFixed(1)}배입니다.` });
      }
    }

    const m0 = meas[0];
    if (m0) {
      const cs = derive.colStats(rows, m0.key); const iqr = (cs.q3 - cs.q1) || 0; const hi = cs.q3 + 1.5 * iqr, lo = cs.q1 - 1.5 * iqr;
      const outl = rows.filter((r) => { const v = r[m0.key]; return v != null && !isNaN(v) && (v > hi || v < lo); }).length;
      if (outl) out.push({ icon: "filter", text: `**${m0.label}**에 IQR 기준 이상치 **${outl}건**이 있습니다 — Cleaning Studio에서 확인해 보세요.` });
    }

    if (dt && m0) {
      const byY = {};
      for (const r of rows) { const y = r[dt.key] != null ? String(r[dt.key]).slice(0, 4) : null; const v = r[m0.key]; if (y && v != null && !isNaN(v)) (byY[y] = byY[y] || []).push(+v); }
      const years = Object.keys(byY).sort();
      if (years.length >= 2 && stat.mean(byY[years[0]])) {
        const g = (stat.mean(byY[years[years.length - 1]]) / stat.mean(byY[years[0]]) - 1) * 100;
        out.push({ icon: "line", text: `평균 **${m0.label}**는 ${years[0]}→${years[years.length - 1]} 동안 **${g >= 0 ? "+" : ""}${g.toFixed(1)}%** 변화했습니다.` });
      }
    }

    if (meas.length >= 2) {
      let best = null;
      for (let i = 0; i < meas.length; i++) for (let j = i + 1; j < meas.length; j++) {
        const rr = stat.pearson(rows.map((r) => r[meas[i].key]), rows.map((r) => r[meas[j].key]));
        if (rr != null && !isNaN(rr) && (!best || Math.abs(rr) > Math.abs(best.r))) best = { a: meas[i], b: meas[j], r: rr };
      }
      if (best && Math.abs(best.r) >= 0.3) out.push({ icon: "heatmap", text: `**${best.a.label}**와 **${best.b.label}**는 ${best.r > 0 ? "양" : "음"}의 상관(r=**${best.r.toFixed(2)}**)을 보입니다.` });
    }
    return out;
  }

  // ---- dynamic suggestion chips from real columns ----
  function suggestions(rows, columns) {
    const dims = dimsOf(columns), meas = measOf(columns), dt = dateOf(columns);
    const d0 = lowCardDim(rows, dims), m0 = meas[0];
    const s = [];
    if (m0 && d0) s.push(`평균 ${m0.label} by ${d0.label}`);
    if (m0 && d0) s.push(`상위 10 ${d0.label} · ${m0.label}`);
    if (d0) s.push(`${d0.label} 비율`);
    if (m0) s.push(`${m0.label} 이상치`);
    if (dt && m0) s.push(`${m0.label} 추세`);
    if (meas.length >= 2) s.push("상관관계 보기");
    s.push("마지막 분석 요약");
    return s.slice(0, 6);
  }

  // ---- NL → intent, resolving any column mentioned by name ----
  function interpret(text, columns, rows) {
    const t = String(text).toLowerCase();
    const dims = dimsOf(columns), meas = measOf(columns);
    const findCol = (pool) => pool.find((c) => t.includes(String(c.label).toLowerCase()) || t.includes(String(c.key).toLowerCase()));
    const dim = findCol(dims) || lowCardDim(rows, dims);
    const measure = findCol(meas) || meas[0];
    if (/(outlier|이상치|anomal)/.test(t)) return { kind: "outlier", measure };
    if (/(correlation|상관)/.test(t)) return { kind: "goStats", tab: "corr" };
    if (/(regress|회귀)/.test(t)) return { kind: "goStats", tab: "reg" };
    if (/(distribut|분포|histogram|boxplot)/.test(t)) return { kind: "goStats", tab: "distribution" };
    if (/(ml|machine|learn|분류|classif|cluster|군집)/.test(t)) return { kind: "goMl" };
    if (/(last|recent|previous|summary|방금|마지막|결과 요약)/.test(t)) return { kind: "last" };
    if (/(trend|추세|시계열|over time|시간|월별|연도)/.test(t)) return { kind: "trend", measure, dim };
    if (/(top|상위|rank|순위)/.test(t)) return { kind: "top", measure, dim };
    if (/(mix|비율|proportion|share|구성|비중|pie|도넛)/.test(t)) return { kind: "mix", dim };
    return { kind: "bar", measure, dim };
  }

  const dimChipOf = (d) => d ? [{ key: d.key, label: d.label, role: "dimension", type: d.type }] : [];
  const measChipOf = (m) => m ? [{ key: m.key, label: m.label, role: "measure", type: m.type, agg: "avg", id: m.key + "_avg" }] : [];

  function runIntent(intent, columns, rows) {
    const a = actions;
    const { kind, dim, measure } = intent;
    if (kind === "outlier") { a.setMode("clean"); return { text: `**Cleaning Studio**를 열었습니다. ${measure ? "**" + measure.label + "**의 " : ""}IQR 이상치를 *Remove outliers*로 제거할 수 있습니다.` }; }
    if (kind === "goStats") { a.setMode("stats"); a.setUI({ stats: { ...(window.Store.getState().ui.stats || {}), test: intent.tab || "corr" } }); return { text: `**Stats Studio** → ${intent.tab === "reg" ? "회귀" : intent.tab === "distribution" ? "분포" : "상관"} 분석으로 이동했습니다.` }; }
    if (kind === "goMl") { a.setMode("ml"); return { text: "**ML Studio**로 이동했습니다. 오른쪽에서 태스크·특징을 고르고 Train 하세요." }; }
    if (kind === "last") {
      const last = window.NODE.lastAnalysisResult;
      if (!last) return { text: "최근 분석 결과가 없습니다. **Stats Studio**나 **ML Studio**에서 먼저 실행하세요." };
      return { text: last.type === "ml" ? `마지막 ML: **${last.task}** on ${last.target || "features"} — score **${last.score}**.` : `마지막 분석: **${last.summary || "요약 없음"}**` };
    }
    // chart intents — build on the ACTIVE dataset's active viz sheet
    a.setMode("visualize");
    if (kind === "mix") {
      if (!dim) return { text: "범주형 차원이 없어 비율 차트를 만들 수 없습니다." };
      const anyKey = (columns[0] || {}).key;
      a.setViz({ type: "pie", cols: dimChipOf(dim), rows: [{ key: anyKey, label: "count", role: "measure", type: "integer", agg: "count", id: anyKey + "_count" }], color: null, sortDesc: true, topN: 8 });
      return { text: `**${dim.label}** 구성 비율을 도넛 차트로 그렸습니다.` };
    }
    if (!measure) return { text: "숫자 측정값이 없어 차트를 만들 수 없습니다. Data/Clean에서 컬럼 타입을 확인하세요." };
    if (kind === "top") {
      a.setViz({ type: "hbar", cols: dimChipOf(dim), rows: measChipOf(measure), color: null, sortDesc: true, topN: 10 });
      return { text: `${dim ? "**" + dim.label + "** " : ""}상위 10을 평균 **${measure.label}** 기준 가로막대로 그렸습니다.` };
    }
    if (kind === "trend") {
      const dt = dateOf(columns);
      if (dt) { a.setViz({ type: "line", cols: [{ key: dt.key, label: dt.label, role: "dimension", type: "datetime" }], rows: measChipOf(measure), color: null, sortDesc: false, topN: 0 }); return { text: `**${measure.label}**의 시간 추세를 라인 차트로 그렸습니다.` }; }
      a.setViz({ type: "bar", cols: dimChipOf(dim), rows: measChipOf(measure), color: null, sortDesc: true, topN: 0 });
      return { text: `날짜 컬럼이 없어 평균 **${measure.label}**${dim ? ` by **${dim.label}**` : ""} 막대 차트로 대신 그렸습니다.` };
    }
    a.setViz({ type: "bar", cols: dimChipOf(dim), rows: measChipOf(measure), color: null, sortDesc: true, topN: 0 });
    return { text: `평균 **${measure.label}**${dim ? ` by **${dim.label}**` : ""} 막대 차트를 그렸습니다.` };
  }

  function fmtMd(s) {
    return String(s).split("**").map((part, i) => i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>);
  }

  function AIDrawer() {
    const open = useStore((s) => s.ui.aiOpen);
    const activeId = useStore((s) => s.activeId);
    const { rows, columns, ds } = derive.getActiveData(activeId);
    const [log, setLog] = React.useState([]);
    const [input, setInput] = React.useState("");
    const insights = React.useMemo(() => { try { return buildInsights(rows, columns); } catch (_) { return []; } }, [activeId, rows]);
    const chips = React.useMemo(() => { try { return suggestions(rows, columns); } catch (_) { return ["마지막 분석 요약"]; } }, [activeId, rows]);

    const profile = React.useMemo(() => {
      if (!IE) return [];
      try { return IE.profileDataset(activeId); } catch (_) { return []; }
    }, [activeId]);

    const bodyRef = React.useRef(null);
    React.useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [log]);

    if (!open) return null;
    const send = (q) => {
      if (!q.trim()) return;
      const intent = interpret(q, columns, rows);
      window.LOG && window.LOG.info("ai", "Ask Insight query", { q: q.trim(), intent: intent.kind });
      let res;
      try { res = runIntent(intent, columns, rows); }
      catch (e) { res = { text: "요청을 처리하지 못했습니다: " + (e && e.message) }; }
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
          {profile.length > 0 && (
            <React.Fragment>
              <div className="ai-section-h"><Icon name="bolt" size={11} style={{ marginRight: 4 }} />Dataset Profile · {ds ? ds.short : activeId}</div>
              {profile.map((text, i) => (
                <div className="insight" key={"prof-" + i}>
                  <span className="insight-ic"><Icon name="stats" size={13} /></span>
                  <div className="insight-tx">{fmtMd(text)}</div>
                </div>
              ))}
            </React.Fragment>
          )}

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

          <div className="ai-section-h" style={{ marginTop: 12 }}>Insights · {rows.length.toLocaleString()} rows</div>
          {insights.length ? insights.map((ins, i) => (
            <div className="insight" key={i}>
              <span className="insight-ic"><Icon name={ins.icon} size={13} /></span>
              <div className="insight-tx">{fmtMd(ins.text)}</div>
            </div>
          )) : (
            <div className="insight"><span className="insight-ic"><Icon name="info" size={13} /></span>
              <div className="insight-tx">이 데이터셋에서 자동 인사이트를 만들 수 없습니다. 측정값·차원 컬럼이 있는지 확인하세요.</div></div>
          )}

          {log.length > 0 && <div className="ai-section-h" style={{ marginTop: 14 }}>Conversation</div>}
          {log.map((m, i) => (
            <div key={i} className={"ai-msg " + m.role}>
              {m.role === "ai" && <span className="insight-ic"><Icon name="ai" size={12} /></span>}
              <div className="ai-bubble">{fmtMd(m.text)}</div>
            </div>
          ))}
        </div>

        <div className="ai-suggest">
          {chips.map((q, i) => <button key={i} className="ai-chip" onClick={() => send(q)}>{q}</button>)}
        </div>
        <div className="ai-input">
          <input className="inp" placeholder="이 데이터에 대해 무엇이든 물어보세요…" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} />
          <button className="btn primary sm" onClick={() => send(input)}><Icon name="play" size={12} /></button>
        </div>
      </div>,
      document.body
    );
  }

  window.AIDrawer = AIDrawer;
})();
