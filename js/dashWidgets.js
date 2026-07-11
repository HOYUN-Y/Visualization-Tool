// dashWidgets.js — Dashboard starter-widget builder + staleness helpers (schema-agnostic, dual-mode).
// Extracted from dashMode.jsx so the dynamic (no-hardcoded-fields) widget generation has Node regression tests.
// Pure functions only. Loadable in browser (window.DashWidgets) and Node (require).
(function () {
  const dashMeasures = (columns) => (columns || []).filter((c) => c.role === "measure");
  const dashDims = (columns) => (columns || []).filter((c) => c.role === "dimension" && (c.type === "category" || c.type === "string"));

  // Build a varied starter dashboard from the ACTIVE dataset's real columns (no hardcoded fields).
  function defaultWidgets(columns) {
    columns = columns || [];
    const meas = dashMeasures(columns);
    const dims = dashDims(columns);
    const dates = columns.filter((c) => c.type === "datetime");
    const anyKey = (columns[0] || { key: "__rid" }).key;   // count uses row length, any key works
    if (!meas.length && !dims.length) {
      return [{ id: "t_note", type: "text", x: 0, y: 0, w: 6, h: 3, title: "Getting started",
        spec: { text: "이 데이터셋에서 측정값(숫자)·차원을 찾지 못했습니다.\nData/Clean 탭에서 컬럼 타입을 확인한 뒤 대시보드를 다시 여세요." } }];
    }
    const m0 = meas[0], m1 = meas[1], d0 = dims[0], d1 = dims[1], dt = dates[0];
    const out = [];

    // ── KPI row — varied aggregations (count · sum · avg · distinct) ──
    const kpiSpecs = [{ measure: anyKey, agg: "count", label: "Rows", fmt: "num" }];
    if (m0) kpiSpecs.push({ measure: m0.key, agg: "sum", label: "Total " + m0.label, fmt: "num" });
    if (m1) kpiSpecs.push({ measure: m1.key, agg: "avg", label: "Avg " + m1.label, fmt: "num" });
    else if (m0) kpiSpecs.push({ measure: m0.key, agg: "avg", label: "Avg " + m0.label, fmt: "num" });
    if (d0) kpiSpecs.push({ measure: d0.key, agg: "countd", label: d0.label + " 종류", fmt: "num" });
    else if (m0) kpiSpecs.push({ measure: m0.key, agg: "max", label: "Max " + m0.label, fmt: "num" });
    kpiSpecs.slice(0, 4).forEach((spec, i) => out.push({ id: "k" + i, type: "kpi", x: i * 3, y: 0, w: 3, h: 2, spec }));

    let y = 2; const H = 6;
    // ── Row A: bar + (time-series line | pie) ──
    if (d0 && m0) out.push({ id: "c_bar", type: "chart", x: 0, y, w: 7, h: H, title: `${m0.label} by ${d0.label}`, spec: { chartType: "bar", cols: [d0.key], measures: [[m0.key, "avg"]] } });
    if (dt && m0) out.push({ id: "c_line", type: "chart", x: 7, y, w: 5, h: H, title: `${m0.label} over ${dt.label}`, spec: { chartType: "line", cols: [dt.key], measures: [[m0.key, "sum"]] } });
    else if (d1 || d0) { const pd = d1 || d0; out.push({ id: "c_pie", type: "chart", x: 7, y, w: 5, h: H, title: `Mix by ${pd.label}`, spec: { chartType: "pie", cols: [pd.key], measures: [[anyKey, "count"]] } }); }
    y += H;
    // ── Row B: (scatter | horizontal-bar ranking) + table ──
    if (m1) out.push({ id: "c_scatter", type: "chart", x: 0, y, w: 7, h: H, title: `${m0.label} vs ${m1.label}`, spec: { chartType: "scatter", cols: [], measures: [[m0.key, "avg"], [m1.key, "avg"]], color: d0 ? d0.key : undefined } });
    else if (d0 && m0) out.push({ id: "c_hbar", type: "chart", x: 0, y, w: 7, h: H, title: `Top ${d0.label}`, spec: { chartType: "hbar", cols: [d0.key], measures: [[m0.key, "sum"]], topN: 10 } });
    if (d0 && m0) out.push({ id: "t_top", type: "table", x: 7, y, w: 5, h: H, title: `Top ${d0.label}`, spec: { dim: d0.key, measure: m0.key, agg: "avg" } });
    y += H;
    // ── Row C (bonus variety): treemap by 2nd dim, + hbar ranking when scatter took row B ──
    if (d1 && m0) out.push({ id: "c_tree", type: "chart", x: 0, y, w: 7, h: H, title: `${m0.label} by ${d1.label}`, spec: { chartType: "treemap", cols: [d1.key], measures: [[m0.key, "sum"]] } });
    if (m1 && d0 && m0) out.push({ id: "c_hbar2", type: "chart", x: d1 ? 7 : 0, y, w: d1 ? 5 : 7, h: H, title: `Top ${d0.label} · Σ${m0.label}`, spec: { chartType: "hbar", cols: [d0.key], measures: [[m0.key, "sum"]], topN: 10 } });

    return out;
  }

  const colExists = (columns, key) => !!key && columns.some((c) => c.key === key);
  // Does a widget reference columns that don't exist in the active dataset?
  function widgetStale(w, columns) {
    const s = w.spec || {};
    if (w.type === "kpi")   return !s.formula && s.agg !== "count" && !!s.measure && !colExists(columns, s.measure);
    if (w.type === "chart") return (s.measures || []).some(([k]) => !colExists(columns, k)) || (s.cols || []).some((k) => !colExists(columns, k));
    if (w.type === "table") return (!!s.dim && !colExists(columns, s.dim)) || (!!s.measure && !colExists(columns, s.measure));
    return false;
  }

  const api = { dashMeasures, dashDims, defaultWidgets, colExists, widgetStale };
  if (typeof window !== "undefined") window.DashWidgets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
