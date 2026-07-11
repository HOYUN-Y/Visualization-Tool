// aiIntent.js — Ask Insight pure helpers: column classification, NL→intent, suggestion chips (dual-mode).
// Extracted from aiDrawer.jsx so the schema-agnostic column/intent logic has Node regression tests.
// Pure functions only (no Store/stat/derive/NODE). Loadable in browser (window.AiIntent) and Node (require).
(function () {
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

  const api = { dimsOf, measOf, dateOf, cardinality, lowCardDim, suggestions, interpret, dimChipOf, measChipOf };
  if (typeof window !== "undefined") window.AiIntent = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
