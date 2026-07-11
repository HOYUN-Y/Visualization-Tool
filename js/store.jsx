/* ============================================================
   NØDE — global store + data transforms + aggregation
   window.Store = { useStore, getState, setState, subscribe, actions, derive, stat }
   ============================================================ */
(function () {
  const D = window.NODE.datasets;

  // ---------- stable hidden row id (__rid) for editing ----------
  // Every source row gets a monotonic __rid so cell/row edit steps can target
  // rows reliably despite grid sort/filter/page and pipeline reordering.
  // __rid is NOT a column (never rendered) and survives {...r} clones.
  let _ridSeq = 1;
  function nextRid() { return _ridSeq++; }
  function ensureRids(ds) {
    if (!ds || ds.__rid_tagged) return ds;
    for (const r of ds.rows) { if (r.__rid == null) r.__rid = _ridSeq++; }
    ds.__rid_tagged = true;
    return ds;
  }
  function restoreRidSequence(datasets) {
    let maxRid = 0;
    datasets.forEach((ds) => {
      (ds.rows || []).forEach((row) => {
        if (Number.isInteger(row.__rid) && row.__rid > maxRid) maxRid = row.__rid;
      });
    });
    _ridSeq = maxRid + 1;
    datasets.forEach((ds) => { ds.__rid_tagged = false; ensureRids(ds); });
  }

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
      format: {          // chart formatting overrides (applied post-build)
        title: { text: "", v: "top", h: "center" },      // chart title (empty = none); v/h/free like legend
        legend: { show: true, v: "top", h: "center" },   // v: top|middle|bottom · h: left|center|right
        labels: { show: false, pos: "top", fmt: "full" },
        gridlines: true,
        smooth: null,    // null = per chart default; true/false override
        colors: {},      // { seriesName: "#hex" }
        seriesNames: {}, // { originalName: "custom label" }
      },
    },
    pivot: {},
    dash: { widgets: null, cross: null, edit: false },
    tweaks: { layout: "classic", sidebar: "rail", tone: "cool", density: "compact" },
  };

  const initialDatasets = JSON.parse(JSON.stringify(D));
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
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function useStore(sel) {
    const select = sel || ((s) => s);
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => subscribe(force), []);
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
        case "drop_duplicates": { const seen = new Set(); rows = rows.filter((r) => { const { __rid, ...rest } = r; const k = JSON.stringify(rest); if (seen.has(k)) return false; seen.add(k); return true; }); break; }
        case "remove_outliers": { const cs = colStats(rows, s.col); const iqr = cs.q3 - cs.q1; const lo = cs.q1 - 1.5 * iqr, hi = cs.q3 + 1.5 * iqr; rows = rows.filter((r) => { const v = r[s.col]; return v == null || (v >= lo && v <= hi); }); break; }
        case "rename": { rows.forEach((r) => { r[s.params.to] = r[s.col]; if (s.params.to !== s.col) delete r[s.col]; }); columns = columns.map((c) => c.key === s.col ? { ...c, key: s.params.to, label: s.params.to } : c); break; }
        case "replace": { rows.forEach((r) => { if (r[s.col] != null && String(r[s.col]) === s.params.from) r[s.col] = s.params.to; }); break; }
        case "change_type": { columns = columns.map((c) => c.key === s.col ? { ...c, type: s.params.to, role: (s.params.to === "integer" || s.params.to === "float") ? "measure" : "dimension" } : c); break; }
        // ---- Phase 2: Encoding ----
        case "label_encode": {
          const vals = [...new Set(rows.map((r) => r[s.col]).filter((v) => v != null && v !== ""))].sort();
          const map = {}; vals.forEach((v, i) => { map[v] = i; });
          const newKey = s.params && s.params.newKey ? s.params.newKey : s.col + "_enc";
          rows.forEach((r) => { r[newKey] = r[s.col] != null && r[s.col] !== "" ? map[r[s.col]] : null; });
          if (!columns.find((c) => c.key === newKey)) columns.push({ key: newKey, label: newKey, type: "integer", role: "measure" });
          break;
        }
        case "dummy_encode": {
          const vals = [...new Set(rows.map((r) => r[s.col]).filter((v) => v != null && v !== ""))].sort();
          const safe = (v) => (s.col + "_" + String(v).replace(/\s+/g, "_")).slice(0, 40);
          vals.forEach((v) => {
            const k = safe(v);
            rows.forEach((r) => { r[k] = r[s.col] === v ? 1 : 0; });
            if (!columns.find((c) => c.key === k)) columns.push({ key: k, label: k, type: "integer", role: "measure" });
          });
          break;
        }
        // ---- Phase 2: Column ops ----
        case "drop_col": {
          columns = columns.filter((c) => c.key !== s.col);
          rows.forEach((r) => { delete r[s.col]; });
          break;
        }
        // ---- Phase 2: Numeric Transforms ----
        case "standardize": {
          const vals = rows.map((r) => r[s.col]); const m = stat.mean(vals), sd = stat.std(vals);
          if (sd && sd > 0) rows.forEach((r) => { if (r[s.col] != null) r[s.col] = NODE.round((r[s.col] - m) / sd, 4); });
          columns = columns.map((c) => c.key === s.col ? { ...c, type: "float" } : c);
          break;
        }
        case "normalize": {
          const vals = rows.map((r) => r[s.col]); const mn = stat.min(vals), mx = stat.max(vals), rng = mx - mn;
          if (rng > 0) rows.forEach((r) => { if (r[s.col] != null) r[s.col] = NODE.round((r[s.col] - mn) / rng, 4); });
          columns = columns.map((c) => c.key === s.col ? { ...c, type: "float" } : c);
          break;
        }
        case "log_transform": {
          rows.forEach((r) => { if (r[s.col] != null && r[s.col] > -1) r[s.col] = NODE.round(Math.log1p(r[s.col]), 4); });
          columns = columns.map((c) => c.key === s.col ? { ...c, type: "float" } : c);
          break;
        }
        case "rank_transform": {
          const sorted = rows.map((r, i) => ({ i, v: r[s.col] })).sort((a, b) => (a.v ?? -Infinity) - (b.v ?? -Infinity));
          const rankArr = new Array(rows.length);
          sorted.forEach((item, ri) => { rankArr[item.i] = ri + 1; });
          rows.forEach((r, i) => { r[s.col] = rankArr[i]; });
          columns = columns.map((c) => c.key === s.col ? { ...c, type: "integer" } : c);
          break;
        }
        case "winsorize": {
          const p = (s.params && s.params.p != null) ? s.params.p / 100 : 0.05;
          const vals = rows.map((r) => r[s.col]);
          const lo = stat.quantile(vals, p), hi = stat.quantile(vals, 1 - p);
          rows.forEach((r) => { if (r[s.col] != null) r[s.col] = Math.min(Math.max(r[s.col], lo), hi); });
          break;
        }
        case "binning": {
          const n = (s.params && s.params.bins) ? s.params.bins : 5;
          const vals = rows.map((r) => r[s.col]); const mn = stat.min(vals), mx = stat.max(vals), w = (mx - mn) / n;
          const newKey = s.col + "_bin";
          rows.forEach((r) => {
            if (r[s.col] == null) { r[newKey] = null; return; }
            let b = Math.floor((r[s.col] - mn) / w); if (b >= n) b = n - 1; if (b < 0) b = 0;
            r[newKey] = `[${NODE.round(mn + b * w, 2)}, ${NODE.round(mn + (b + 1) * w, 2)})`;
          });
          if (!columns.find((c) => c.key === newKey)) columns.push({ key: newKey, label: newKey, type: "category", role: "dimension" });
          break;
        }
        // ---- Phase 2: Formula Column ----
        case "formula": {
          const newKey = s.params.name || "formula_col";
          let fn; try { fn = new Function("row", "Math", `"use strict"; return (${s.params.expr})`); } catch (e) { break; }
          rows.forEach((r) => { try { r[newKey] = fn(r, Math); } catch (e) { r[newKey] = null; } });
          if (!columns.find((c) => c.key === newKey)) {
            const sample = rows.find((r) => r[newKey] != null)?.[newKey];
            const type = typeof sample === "number" ? (Number.isInteger(sample) ? "integer" : "float") : "string";
            columns.push({ key: newKey, label: newKey, type, role: type === "string" ? "dimension" : "measure" });
          }
          break;
        }
        // ---- Phase 3: Direct editing (row-targeted by __rid) ----
        case "set_cell": {
          const col = columns.find((c) => c.key === s.col);
          let v = s.params.value;
          if (col && (col.type === "integer" || col.type === "float")) {
            if (v === "" || v == null) v = null;
            else { const n = Number(v); if (!Number.isNaN(n)) v = col.type === "integer" ? Math.round(n) : n; }
          }
          const r = rows.find((row) => row.__rid === s.rid);
          if (r) r[s.col] = v;
          break;
        }
        case "drop_rows": {
          const set = new Set(s.rids || []);
          rows = rows.filter((r) => !set.has(r.__rid));
          break;
        }
        case "add_row": {
          const nr = { ...(s.params.row || {}) };
          if (nr.__rid == null) nr.__rid = s.params.rid;
          columns.forEach((c) => { if (!(c.key in nr)) nr[c.key] = null; });
          rows.push(nr);
          break;
        }
        case "add_col": {
          const key = s.params.key;
          const type = s.params.type || "string";
          const role = s.params.role || ((type === "integer" || type === "float") ? "measure" : "dimension");
          const def = s.params.default !== undefined ? s.params.default : null;
          if (!columns.find((c) => c.key === key)) {
            const col = { key, label: s.params.label || key, type, role };
            const at = s.params.at;
            if (typeof at === "number" && at >= 0 && at <= columns.length) columns.splice(at, 0, col);
            else columns.push(col);
          }
          rows.forEach((r) => { if (!(key in r)) r[key] = def; });
          break;
        }
        case "reorder_cols": {
          const order = s.params.order;
          if (Array.isArray(order)) {
            const map = new Map(columns.map((c) => [c.key, c]));
            const next = order.map((k) => map.get(k)).filter(Boolean);
            columns.forEach((c) => { if (!order.includes(c.key)) next.push(c); });
            columns = next;
          }
          break;
        }
        default: break;
      }
    }
    return { rows, columns };
  }

  // active (cleaned) dataset
  function getDataset(id) { return ensureRids(D.find((d) => d.id === (id || state.activeId))); }
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

    // project lifecycle + centralized dataset registry
    hydrateProject: (bundle) => {
      if (!bundle || !Array.isArray(bundle.datasets) || !bundle.datasets.length) throw new Error("Project bundle requires datasets");
      const datasets = JSON.parse(JSON.stringify(bundle.datasets));
      D.splice(0, D.length, ...datasets);
      restoreRidSequence(D);

      const saved = JSON.parse(JSON.stringify(bundle.state || {}));
      const next = deepMerge(JSON.parse(JSON.stringify(initial)), saved);
      next.ui = { ...initial.ui, ...(saved.ui || {}), aiOpen: false };
      if (!D.some((ds) => ds.id === next.activeId)) next.activeId = D[0].id;
      state = next;

      const analysis = bundle.analysis || {};
      window.NODE.mlHistory = JSON.parse(JSON.stringify(analysis.mlHistory || []));
      window.NODE.lastAnalysisResult = analysis.lastAnalysisResult == null
        ? null
        : JSON.parse(JSON.stringify(analysis.lastAnalysisResult));
      listeners.forEach((listener) => listener());
      return state;
    },
    registerDataset: (dataset, options) => {
      if (!dataset || typeof dataset.id !== "string" || !dataset.id || !Array.isArray(dataset.rows) || !Array.isArray(dataset.columns)) {
        throw new Error("Dataset requires id, rows, and columns");
      }
      if (D.some((existing) => existing.id === dataset.id)) throw new Error("Dataset id already exists: " + dataset.id);
      const next = JSON.parse(JSON.stringify(dataset));
      ensureRids(next);
      D.push(next);
      const activate = !options || options.activate !== false;
      setState((s) => activate
        ? { ...s, activeId: next.id, ui: { ...s.ui, selCol: null } }
        : { ...s });
      return next;
    },
    removeDataset: (id) => {
      const index = D.findIndex((dataset) => dataset.id === id);
      if (index < 0) return false;
      if (D.length === 1) throw new Error("A project must keep at least one dataset");
      D.splice(index, 1);
      setState((s) => {
        const clean = { ...s.clean };
        delete clean[id];
        return {
          ...s,
          clean,
          activeId: s.activeId === id ? D[Math.min(index, D.length - 1)].id : s.activeId,
          ui: s.activeId === id ? { ...s.ui, selCol: null } : s.ui,
        };
      });
      return true;
    },

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

    // direct editing (all routed through addStep → undo/redo + step log for free)
    editCell: (rid, col, value) => actions.addStep({ op: "set_cell", rid, col, params: { value } }),
    deleteRows: (rids) => actions.addStep({ op: "drop_rows", rids: Array.isArray(rids) ? rids : [rids] }),
    addRow: (row) => actions.addStep({ op: "add_row", params: { row: row || {}, rid: nextRid() } }),
    addColumn: (def) => actions.addStep({ op: "add_col", params: def || {} }),
    reorderCols: (order) => actions.addStep({ op: "reorder_cols", params: { order } }),

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
    setFormat: (patch) => setState((s) => {
      const f = s.viz.format || {};
      const next = { ...f, ...patch };
      if (patch.title) next.title = { ...f.title, ...patch.title };
      if (patch.legend) next.legend = { ...f.legend, ...patch.legend };
      if (patch.labels) next.labels = { ...f.labels, ...patch.labels };
      if (patch.colors) next.colors = { ...f.colors, ...patch.colors };
      if (patch.seriesNames) next.seriesNames = { ...f.seriesNames, ...patch.seriesNames };
      return { ...s, viz: { ...s.viz, format: next } };
    }),
    setRowMark: (key, mark) => setState((s) => ({ ...s, viz: { ...s.viz, rows: s.viz.rows.map((r) => r.key === key ? { ...r, mark } : r) } })),
    setRowAxis: (key, axis) => setState((s) => ({ ...s, viz: { ...s.viz, rows: s.viz.rows.map((r) => r.key === key ? { ...r, axis } : r) } })),

    // dashboard
    setDash: (patch) => setState((s) => ({ ...s, dash: { ...s.dash, ...patch } })),
    setCross: (c) => setState((s) => ({ ...s, dash: { ...s.dash, cross: c } })),

    // pivot
    setPivot: (patch) => setState((s) => ({ ...s, pivot: { ...s.pivot, ...patch } })),
  };

  function getDefaultProjectSnapshot() {
    return {
      state: JSON.parse(JSON.stringify(initial)),
      datasets: JSON.parse(JSON.stringify(initialDatasets)),
      analysis: { mlHistory: [], lastAnalysisResult: null },
    };
  }

  window.Store = {
    useStore, getState, setState, subscribe, actions, getDefaultProjectSnapshot,
    derive: { getDataset, getActiveData, getClean, aggregate, colStats, applySteps }, stat, aggFn,
  };
})();
