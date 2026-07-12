/* insight Analytics — hand-written JS SQL engine (fallback for when DuckDB-WASM is unavailable:
   offline / CDN unreachable). Extracted from sqlMode.jsx so it is dual-mode (window.SQLFallback +
   module.exports) and Node-testable. Dependencies are injected via ctx (no window globals here).

   Unicode identifiers: DuckDB (the primary path) handles quoted Korean identifiers natively; this
   fallback previously used ASCII-only [\w]+ which broke on Korean column/table names. Identifier
   pattern is now \p{L}\p{N}_ with the /u flag (same model as kpiFormula.js). */
(function () {
  "use strict";

  const ID = "[\\p{L}\\p{N}_]+";                         // unicode-aware identifier
  const AGG_RE = new RegExp(`^(sum|avg|count|min|max|median)\\s*\\(\\s*(\\*|${ID})\\s*\\)$`, "iu");
  const AS_RE = new RegExp(`\\s+as\\s+(${ID})\\s*$`, "iu");
  const WHERE_RE = new RegExp(`^(${ID})\\s*(>=|<=|!=|<>|=|>|<|like)\\s*(.+)$`, "iu");
  const ORDER_RE = new RegExp(`^(${ID})\\s*(asc|desc)?`, "iu");

  function splitTop(s, sep) {
    const out = []; let depth = 0, cur = "";
    for (const ch of s) {
      if (ch === "(") depth++; if (ch === ")") depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur); return out.map((x) => x.trim());
  }

  function parseSelectItem(item) {
    let alias = null;
    const am = item.match(AS_RE);
    if (am) { alias = am[1]; item = item.slice(0, am.index).trim(); }
    const ag = item.match(AGG_RE);
    if (ag) { const fn = ag[1].toLowerCase(), col = ag[2]; return { kind: "agg", fn, col, alias: alias || `${fn}_${col === "*" ? "all" : col}` }; }
    return { kind: "col", col: item, alias: alias || item };
  }

  function parseWhere(s) {
    return splitTop(s, " ").join(" ").split(/\s+and\s+/i).map((c) => {
      const m = c.trim().match(WHERE_RE);
      if (!m) throw new Error("Cannot parse WHERE: " + c);
      let val = m[3].trim();
      const isStr = /^['"].*['"]$/.test(val);
      if (isStr) val = val.slice(1, -1); else if (/^-?\d+(\.\d+)?$/.test(val)) val = parseFloat(val);
      return { col: m[1], op: m[2].toLowerCase(), val, isStr };
    });
  }

  function testWhere(row, conds) {
    return conds.every((c) => {
      const v = row[c.col];
      switch (c.op) {
        case "=": return String(v) == String(c.val);
        case "!=": case "<>": return String(v) != String(c.val);
        case ">": return v > c.val; case "<": return v < c.val;
        case ">=": return v >= c.val; case "<=": return v <= c.val;
        case "like": { const re = new RegExp("^" + String(c.val).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i"); return re.test(String(v)); }
      }
    });
  }

  // Run a SELECT against injected datasets.
  //   ctx = { datasets:[{id,short,columns}], getRows:(id)=>rows[], aggFn:{sum,avg,...}, round:(v,d)=>v }
  function runSQL(sql, ctx) {
    ctx = ctx || {};
    const datasets = ctx.datasets || [];
    const getRows = ctx.getRows || (() => []);
    const aggFn = ctx.aggFn || {};
    const round = ctx.round || ((v) => v);
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const t0 = now();
    try {
      let s = sql.replace(/;\s*$/, "").replace(/\s+/g, " ").trim();
      const fromM = s.match(/\bfrom\b/i); if (!fromM) throw new Error("Missing FROM clause");
      const selPart = s.slice(0, fromM.index).replace(/^select\s+/i, "").trim();
      let rest = s.slice(fromM.index + 4).trim();
      const kw = rest.search(/\b(where|group by|order by|limit)\b/i);
      const tableName = (kw === -1 ? rest : rest.slice(0, kw)).trim();
      rest = kw === -1 ? "" : rest.slice(kw);
      const ds = datasets.find((d) => d.id.toLowerCase() === tableName.toLowerCase() || d.short.toLowerCase() === tableName.toLowerCase());
      if (!ds) throw new Error(`Unknown table "${tableName}". Try: ${datasets.map((d) => d.id).join(", ")}`);

      const grab = (re) => { const m = rest.match(re); return m ? m[1].trim() : null; };
      const whereS = grab(/\bwhere\b(.+?)(?:\bgroup by\b|\border by\b|\blimit\b|$)/i);
      const groupS = grab(/\bgroup by\b(.+?)(?:\border by\b|\blimit\b|$)/i);
      const orderS = grab(/\border by\b(.+?)(?:\blimit\b|$)/i);
      const limitS = grab(/\blimit\b\s*(\d+)/i);

      let rows = getRows(ds.id); // base rows incl. any cleaning steps
      const conds = whereS ? parseWhere(whereS) : null;
      if (conds) rows = rows.filter((r) => testWhere(r, conds));

      const items = splitTop(selPart, ",").map(parseSelectItem);
      const star = items.length === 1 && items[0].col === "*";
      const groupBy = groupS ? splitTop(groupS, ",") : [];
      const hasAgg = items.some((i) => i.kind === "agg");

      let out;
      if (star && !hasAgg && !groupBy.length) {
        out = rows.map((r) => ({ ...r }));
      } else if (groupBy.length || hasAgg) {
        const groups = new Map();
        for (const r of rows) { const k = groupBy.map((g) => r[g]).join(""); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
        out = [];
        for (const grp of groups.values()) {
          const o = {};
          for (const it of items) {
            if (it.kind === "col") o[it.alias] = grp[0][it.col];
            else if (it.col === "*" && it.fn === "count") o[it.alias] = grp.length;
            else o[it.alias] = aggFn[it.fn] ? round(aggFn[it.fn](grp.map((r) => r[it.col])), 2) : null;
          }
          out.push(o);
        }
      } else {
        out = rows.map((r) => { const o = {}; for (const it of items) o[it.alias] = r[it.col]; return o; });
      }

      if (orderS) {
        const om = orderS.match(ORDER_RE); const key = om[1], dir = (om[2] || "asc").toLowerCase() === "desc" ? -1 : 1;
        out.sort((a, b) => { const x = a[key], y = b[key]; if (x == null) return 1; if (y == null) return -1; return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ko")) * dir; });
      }
      if (limitS) out = out.slice(0, parseInt(limitS));

      // infer columns
      const keys = out.length ? Object.keys(out[0]) : items.map((i) => i.alias);
      const columns = keys.map((k) => {
        const sample = out.find((r) => r[k] != null);
        const v = sample ? sample[k] : null;
        let type = "string", role = "dimension";
        if (typeof v === "number") { type = Number.isInteger(v) ? "integer" : "float"; role = "measure"; }
        else if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) type = "datetime";
        else if (typeof v === "string") { const dist = new Set(out.map((r) => r[k])).size; type = dist <= 30 ? "category" : "string"; }
        const src = (ds.columns || []).find((c) => c.key === k);
        return { key: k, label: k, type, role, fmt: src ? src.fmt : null, unit: src ? src.unit : null };
      });
      return { columns, rows: out, ms: (now() - t0).toFixed(1), table: ds, n: out.length };
    } catch (e) { return { error: e.message, ms: (now() - t0).toFixed(1) }; }
  }

  const api = { splitTop, parseSelectItem, parseWhere, testWhere, runSQL, AGG_RE };
  if (typeof window !== "undefined") window.SQLFallback = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
