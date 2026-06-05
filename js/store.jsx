/* ============================================================
   NØDE — global store + data transforms + aggregation
   window.Store = { useStore, getState, setState, actions, derive, stat }
   ============================================================ */
(function () {
  const D = window.NODE.datasets;

  const initial = {
    theme: "dark",
    mode: "data",
    activeId: "seoul_txns",
    ui: { leftW: 230, rightW: 268, dataTab: "preview", selCol: null, aiOpen: false },
    clean: {},          // { datasetId: { steps:[], cursor:0 } }
    viz: {
      type: "bar",
      cols: [],         // dimension chips on Columns shelf {key,label,role}
      rows: [],         // measure chips on Rows shelf {key,label,agg}
      color: null,      // {key,label,role}
      label: null,
      filters: [],      // [{key,label,values:[...]}]  (category filters)
      sortDesc: true,
      topN: 0,
    },
    dash: { widgets: null, cross: null, edit: false },
    tweaks: { layout: "classic", sidebar: "rail", tone: "cool", density: "compact" },
  };

  let state = JSON.parse(JSON.stringify(initial));
  const listeners = new Set();

  function setState(patch) {
    state = typeof patch === "function" ? patch(state) : deepMerge(state, patch);
    listeners.forEach((l) => l());
  }
  function deepMerge(a, b) {
    const o = { ...a };
    for (const k in b) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k]))
        o[k] = deepMerge(a[k], b[k]);
      else o[k] = b[k];
    }
    return o;
  }
  function getState() { return state; }

  function useStore(sel) {
    const select = sel || ((s) => s);
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => { listeners.add(force); return () => listeners.delete(force); }, []);
    return select(state);
  }

  // ---------- stats ----------
  const num = (a) => a.filter((v) => v != null && v !== "" && !isNaN(v)).map(Number);
  const stat = {
    mean: (a) => { const x = num(a); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; },
    sum: (a) => num(a).reduce((s, v) => s + v, 0),
    min: (a) => { const x = num(a); return x.length ? Math.min(...x) : null; },
    max: (a) => { const x = num(a); return x.length ? Math.max(...x) : null; },
    median: (a) => { const x = num(a).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; },
    quantile: (a, q) => { const x = num(a).sort((p, q2) => p - q2); if (!x.length) return null; const pos = (x.length - 1) * q, b = Math.floor(pos), rest = pos - b; return x[b + 1] !== undefined ? x[b] + rest * (x[b + 1] - x[b]) : x[b]; },
    std: (a) => { const x = num(a); if (x.length < 2) return null; const m = x.reduce((s, v) => s + v, 0) / x.length; return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)); },
    mode: (a) => { const m = {}; let best = null, bc = -1; for (const v of a) { if (v == null || v === "") continue; m[v] = (m[v] || 0) + 1; if (m[v] > bc) { bc = m[v]; best = v; } } return best; },
    countDistinct: (a) => new Set(a.filter((v) => v != null && v !== "")).size,
    missing: (a) => a.filter((v) => v == null || v === "").length,
    pearson: (a, b) => {
      const pairs = []; for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null && !isNaN(a[i]) && !isNaN(b[i])) pairs.push([+a[i], +b[i]]);
      const n = pairs.length; if (n < 2) return null;
      const mx = pairs.reduce((s, p) => s + p[0], 0) / n, my = pairs.reduce((s, p) => s + p[1], 0) / n;
      let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
      return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
    },
    histogram: (a, bins = 20) => {
      const x = num(a); if (!x.length) return { bins: [], max: 0 };
      const lo = Math.min(...x), hi = Math.max(...x), w = (hi - lo) / bins || 1;
      const out = Array.from({ length: bins }, (_, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, c: 0 }));
      for (const v of x) { let i = Math.floor((v - lo) / w); if (i >= bins) i = bins - 1; if (i < 0) i = 0; out[i].c++; }
      return { bins: out, max: Math.max(...out.map((b) => b.c)) };
    },
  };

  const aggFn = {
    sum: stat.sum, avg: stat.mean, mean: stat.mean, median: stat.median,
    min: stat.min, max: stat.max, count: (a) => a.length, countd: stat.countDistinct,
  };

  // ---------- cleaning transforms ----------
  function colStats(rows, key) {
    const col = rows.map((r) => r[key]);
    return { mean: stat.mean(col), median: stat.median(col), mode: stat.mode(col),
      q1: stat.quantile(col, 0.25), q3: stat.quantile(col, 0.75) };
  }
  function applySteps(dataset, steps) {
    let rows = dataset.rows.map((r) => ({ ...r }));
    let columns = dataset.columns.map((c) => ({ ...c }));
    for (const s of steps) {
      switch (s.op) {
        case "drop_missing": rows = rows.filter((r) => r[s.col] != null && r[s.col] !== ""); break;
        case "fill_mean": { const m = stat.mean(rows.map((r) => r[s.col])); rows.forEach((r) => { if (r[s.col] == null || r[s.col] === "") r[s.col] = NODE.round(m, 1); }); break; }
        case "fill_median": { const m = stat.median(rows.map((r) => r[s.col])); rows.forEach((r) => { if (r[s.col] == null || r[s.col] === "") r[s.col] = m; }); break; }
        case "fill_mode": { const m = stat.mode(rows.map((r) => r[s.col])); rows.forEach((r) => { if (r[s.col] == null || r[s.col] === "") r[s.col] = m; }); break; }
        case "drop_duplicates": { const seen = new Set(); rows = rows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); break; }
        case "remove_outliers": { const cs = colStats(rows, s.col); const iqr = cs.q3 - cs.q1; const lo = cs.q1 - 1.5 * iqr, hi = cs.q3 + 1.5 * iqr; rows = rows.filter((r) => { const v = r[s.col]; return v == null || (v >= lo && v <= hi); }); break; }
        case "rename": { rows.forEach((r) => { r[s.params.to] = r[s.col]; if (s.params.to !== s.col) delete r[s.col]; }); columns = columns.map((c) => c.key === s.col ? { ...c, key: s.params.to, label: s.params.to } : c); break; }
        case "replace": { rows.forEach((r) => { if (r[s.col] != null && String(r[s.col]) === s.params.from) r[s.col] = s.params.to; }); break; }
        case "change_type": { columns = columns.map((c) => c.key === s.col ? { ...c, type: s.params.to, role: (s.params.to === "integer" || s.params.to === "float") ? "measure" : "dimension" } : c); break; }
        default: break;
      }
    }
    return { rows, columns };
  }

  // active (cleaned) dataset
  function getDataset(id) { return D.find((d) => d.id === (id || state.activeId)); }
  function getClean(id) { id = id || state.activeId; return state.clean[id] || { steps: [], cursor: 0 }; }
  function getActiveData(id) {
    id = id || state.activeId;
    const ds = getDataset(id);
    const cl = getClean(id);
    const active = cl.steps.slice(0, cl.cursor);
    return { ds, ...applySteps(ds, active), steps: cl.steps, cursor: cl.cursor };
  }

  // ---------- aggregation for viz ----------
  function aggregate(rows, dimKeys, measures) {
    if (!dimKeys.length && !measures.length) return [];
    const groups = new Map();
    for (const r of rows) {
      const key = dimKeys.map((k) => r[k]).join("\u0001");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const out = [];
    for (const [key, grp] of groups) {
      const o = {};
      const kv = key.split("\u0001");
      dimKeys.forEach((k, i) => (o[k] = kv[i]));
      for (const m of measures) {
        const vals = grp.map((r) => r[m.key]);
        o[m.id || m.key] = aggFn[m.agg] ? aggFn[m.agg](vals) : stat.sum(vals);
      }
      o.__count = grp.length;
      out.push(o);
    }
    return out;
  }

  // ---------- actions ----------
  const actions = {
    setTheme: (t) => setState({ theme: t }),
    toggleTheme: () => setState((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" })),
    setMode: (m) => setState({ mode: m }),
    setActive: (id) => setState((s) => ({ ...s, activeId: id, ui: { ...s.ui, selCol: null } })),
    setUI: (patch) => setState((s) => ({ ...s, ui: { ...s.ui, ...patch } })),
    setTweak: (patch) => setState((s) => ({ ...s, tweaks: { ...s.tweaks, ...patch } })),

    // cleaning
    addStep: (step) => setState((s) => {
      const id = s.activeId; const cur = s.clean[id] || { steps: [], cursor: 0 };
      const steps = cur.steps.slice(0, cur.cursor); steps.push({ ...step, id: Date.now() + Math.random() });
      return { ...s, clean: { ...s.clean, [id]: { steps, cursor: steps.length } } };
    }),
    undo: () => setState((s) => { const id = s.activeId; const cur = s.clean[id]; if (!cur || cur.cursor === 0) return s; return { ...s, clean: { ...s.clean, [id]: { ...cur, cursor: cur.cursor - 1 } } }; }),
    redo: () => setState((s) => { const id = s.activeId; const cur = s.clean[id]; if (!cur || cur.cursor >= cur.steps.length) return s; return { ...s, clean: { ...s.clean, [id]: { ...cur, cursor: cur.cursor + 1 } } }; }),
    gotoStep: (i) => setState((s) => { const id = s.activeId; const cur = s.clean[id]; if (!cur) return s; return { ...s, clean: { ...s.clean, [id]: { ...cur, cursor: i } } }; }),
    clearSteps: () => setState((s) => ({ ...s, clean: { ...s.clean, [s.activeId]: { steps: [], cursor: 0 } } })),

    // viz
    setViz: (patch) => setState((s) => ({ ...s, viz: { ...s.viz, ...patch } })),
    addToShelf: (shelf, field) => setState((s) => {
      const viz = { ...s.viz };
      if (shelf === "cols") { if (!viz.cols.find((c) => c.key === field.key)) viz.cols = [...viz.cols, field]; }
      else if (shelf === "rows") { if (!viz.rows.find((c) => c.key === field.key)) viz.rows = [...viz.rows, { ...field, agg: field.agg || "sum", id: field.key + "_" + (field.agg || "sum") }]; }
      else if (shelf === "color") viz.color = field;
      return { ...s, viz };
    }),
    removeFromShelf: (shelf, key) => setState((s) => {
      const viz = { ...s.viz };
      if (shelf === "cols") viz.cols = viz.cols.filter((c) => c.key !== key);
      else if (shelf === "rows") viz.rows = viz.rows.filter((c) => c.key !== key);
      else if (shelf === "color") viz.color = null;
      return { ...s, viz };
    }),
    setRowAgg: (key, agg) => setState((s) => ({ ...s, viz: { ...s.viz, rows: s.viz.rows.map((r) => r.key === key ? { ...r, agg, id: r.key + "_" + agg } : r) } })),

    // dashboard
    setDash: (patch) => setState((s) => ({ ...s, dash: { ...s.dash, ...patch } })),
    setCross: (c) => setState((s) => ({ ...s, dash: { ...s.dash, cross: c } })),
  };

  window.Store = { useStore, getState, setState, actions, derive: { getDataset, getActiveData, getClean, aggregate, colStats, applySteps }, stat, aggFn };
})();
