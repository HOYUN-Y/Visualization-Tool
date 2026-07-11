/* insight Analytics — pure Pivot Table engine (window.PivotEngine)
   Deterministic cross-tab: Rows × Columns dimensions, multiple Values with
   independent aggregations, category/range filters, Grand Totals recomputed
   from source rows (correct for avg/median, not sum-of-cells). Node-testable. */
(function () {
  "use strict";

  const SEP = "";

  function toNums(arr) {
    const out = [];
    for (const v of arr) { if (v != null && v !== "" && !isNaN(v)) out.push(Number(v)); }
    return out;
  }
  function median(nums) {
    if (!nums.length) return null;
    const s = [...nums].sort((a, b) => a - b); const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  // Aggregate a column slice. Empty group → 0 for sum/count/countd, null otherwise.
  function aggregate(values, agg) {
    switch (agg) {
      case "count": return values.length;
      case "countd": return new Set(values.filter((v) => v != null && v !== "")).size;
      case "sum": return toNums(values).reduce((a, b) => a + b, 0);
      case "avg": case "mean": { const n = toNums(values); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null; }
      case "min": { const n = toNums(values); return n.length ? Math.min(...n) : null; }
      case "max": { const n = toNums(values); return n.length ? Math.max(...n) : null; }
      case "median": return median(toNums(values));
      default: return toNums(values).reduce((a, b) => a + b, 0);
    }
  }

  function normalizeFilters(filters) {
    return (filters || []).map((f) => {
      if (f.kind === "in") return { key: f.key, kind: "in", set: f.set instanceof Set ? f.set : new Set((f.values || f.set || []).map(String)) };
      if (f.kind === "range") return { key: f.key, kind: "range", min: f.min == null ? null : Number(f.min), max: f.max == null ? null : Number(f.max) };
      return { key: f.key, kind: "noop" };
    });
  }
  function applyFilters(rows, filters) {
    if (!filters.length) return rows;
    return rows.filter((r) => filters.every((f) => {
      const v = r[f.key];
      if (f.kind === "in") return f.set.has(String(v));
      if (f.kind === "range") return v == null || ((f.min == null || v >= f.min) && (f.max == null || v <= f.max));
      return true;
    }));
  }

  const canonVal = (v) => (v == null ? "" : String(v));
  const tupleId = (r, keys) => keys.map((k) => canonVal(r[k])).join(SEP);
  // Canonicalize a raw tuple (from distinctTuples) the SAME way tupleId does, so cell/subtotal
  // lookups match the bucket keys even when a dimension value is null/blank.
  const tupleKey = (tuple) => tuple.map(canonVal).join(SEP);
  function distinctTuples(rows, keys) {
    if (!keys.length) return [[]];
    const seen = new Map();
    for (const r of rows) { const id = tupleId(r, keys); if (!seen.has(id)) seen.set(id, keys.map((k) => r[k])); }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined)).map((e) => e[1]);
  }

  // spec: { rows:[key], columns:[key], values:[{key,agg,label}], filters:[], grandTotals?:true }
  function build(sourceRows, sourceColumns, spec) {
    spec = spec || {};
    const rowFields = spec.rows || [];
    const colFields = spec.columns || [];
    const values = (spec.values || []).map((v) => ({ key: v.key, agg: v.agg || "sum", label: v.label || `${(v.agg || "sum").toUpperCase()}(${v.key})`, id: `${v.key}__${v.agg || "sum"}` }));
    if (!values.length) throw new Error("Pivot requires at least one value field");

    const filters = normalizeFilters(spec.filters);
    const rows = applyFilters(sourceRows || [], filters);

    const rowTuples = distinctTuples(rows, rowFields);
    const colTuples = distinctTuples(rows, colFields);

    // index rows by (rowId, colId) for cell aggregation
    const bucket = new Map(); // rowId -> colId -> rows[]
    const byRow = new Map();  // rowId -> rows[]  (for row grand totals)
    const byCol = new Map();  // colId -> rows[]  (for col grand totals)
    for (const r of rows) {
      const rid = tupleId(r, rowFields), cid = tupleId(r, colFields);
      if (!bucket.has(rid)) bucket.set(rid, new Map());
      const m = bucket.get(rid);
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid).push(r);
      if (!byRow.has(rid)) byRow.set(rid, []); byRow.get(rid).push(r);
      if (!byCol.has(cid)) byCol.set(cid, []); byCol.get(cid).push(r);
    }

    // leaf columns = colTuple × value
    const leaves = [];
    for (const ct of colTuples) {
      const cid = colFields.length ? tupleKey(ct) : "";
      for (const v of values) {
        leaves.push({
          id: (colFields.length ? cid + "¦" : "") + v.id,
          colTuple: ct, value: v,
          label: (colFields.length ? ct.join(" / ") : "") + (colFields.length && values.length > 1 ? " · " : "") + (colFields.length && values.length === 1 ? "" : v.label),
        });
      }
    }

    // matrix
    const outRows = rowTuples.map((rt) => {
      const rid = rowFields.length ? tupleKey(rt) : "";
      const cells = {};
      const m = bucket.get(rid) || new Map();
      for (const leaf of leaves) {
        const cid = colFields.length ? tupleKey(leaf.colTuple) : "";
        const slice = (m.get(cid) || []).map((r) => r[leaf.value.key]);
        cells[leaf.id] = m.has(cid) ? aggregate(slice, leaf.value.agg) : (["sum", "count", "countd"].includes(leaf.value.agg) ? 0 : null);
      }
      // row grand total per value — recomputed from all rows in this row group
      const total = {};
      for (const v of values) total[v.id] = aggregate((byRow.get(rid) || []).map((r) => r[v.key]), v.agg);
      return { key: rt, id: rid, cells, total };
    });

    // column grand totals per leaf + overall grand total per value
    const colTotals = {}, grandTotal = {};
    for (const leaf of leaves) {
      const cid = colFields.length ? tupleKey(leaf.colTuple) : "";
      colTotals[leaf.id] = aggregate((byCol.get(cid) || []).map((r) => r[leaf.value.key]), leaf.value.agg);
    }
    for (const v of values) grandTotal[v.id] = aggregate(rows.map((r) => r[v.key]), v.agg);

    return {
      rowFields, colFields, values, leaves,
      rows: outRows, colTotals, grandTotal,
      rowCount: rows.length,
      spec: { rows: rowFields, columns: colFields, values: spec.values || [], filters: spec.filters || [] },
    };
  }

  // Flatten a pivot result to a registerable dataset.
  function toDataset(result, meta) {
    meta = meta || {};
    if (!result || !Array.isArray(result.rows) || !Array.isArray(result.leaves)) throw new Error("toDataset requires a pivot result");
    const short = meta.short || meta.name || "pivot";
    const idBase = `pivot_${String(short).normalize("NFKC").replace(/[^a-zA-Z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "pivot"}`;
    const columns = [];
    result.rowFields.forEach((k, i) => columns.push({ key: k, label: k, type: "string", role: "dimension", agg: null, unit: null, fmt: null }));
    result.leaves.forEach((leaf) => {
      const isInt = leaf.value.agg === "count" || leaf.value.agg === "countd";
      columns.push({ key: leaf.id, label: leaf.label || leaf.value.label, type: isInt ? "integer" : "float", role: "measure", agg: leaf.value.agg === "count" || leaf.value.agg === "countd" ? "sum" : leaf.value.agg, unit: null, fmt: null });
    });
    const rows = result.rows.map((r) => {
      const o = {};
      result.rowFields.forEach((k, i) => { o[k] = r.key[i] == null ? null : r.key[i]; });
      result.leaves.forEach((leaf) => { o[leaf.id] = r.cells[leaf.id]; });
      return o;
    });
    if (meta.grandTotalRow) {
      const g = {};
      result.rowFields.forEach((k, i) => { g[k] = i === 0 ? "Grand Total" : null; });
      result.leaves.forEach((leaf) => { g[leaf.id] = result.colTotals[leaf.id]; });
      rows.push(g);
    }
    return { id: meta.id || idBase, name: meta.name || `${short}.csv`, short, icon: "table", source: "Pivot", rows, columns, lineage: { op: "pivot", spec: result.spec, createdAt: meta.createdAt || null } };
  }

  const api = { build, toDataset, aggregate };
  if (typeof window !== "undefined") window.PivotEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
