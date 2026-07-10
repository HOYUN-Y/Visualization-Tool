/* insight Analytics — pure Union / Join engine (window.DataOps)
   Combines datasets into new materialized datasets with lineage metadata.
   Pure and deterministic: no Date.now()/Math.random() — callers inject timestamps. */
(function () {
  "use strict";

  // ── type promotion: boolean → integer → float → string ──────────────
  const NUM_RANK = { boolean: 0, integer: 1, float: 2 };

  function promoteType(types) {
    const uniq = [...new Set(types.filter(Boolean))];
    if (uniq.length <= 1) return uniq[0] || "string";
    if (uniq.every((t) => t in NUM_RANK)) {
      return uniq.reduce((best, t) => (NUM_RANK[t] > NUM_RANK[best] ? t : best));
    }
    return "string"; // datetime/category/string mismatch collapses to string
  }

  function roleFor(type, fallback) {
    if (type === "integer" || type === "float") return "measure";
    if (type === "boolean" || type === "category" || type === "datetime" || type === "string") return "dimension";
    return fallback || "dimension";
  }

  function isBlank(value) {
    return value == null || (typeof value === "string" && value.trim() === "");
  }

  // ── UNION ───────────────────────────────────────────────────────────
  // datasets: [{ id, short, columns:[{key,label,type,role,...}], rows:[...] }]
  // options: { addSource?: boolean, createdAt?: string }
  function union(datasets, options) {
    options = options || {};
    if (!Array.isArray(datasets) || datasets.length < 2) throw new Error("Union requires at least two datasets");
    datasets.forEach((ds, i) => {
      if (!ds || !Array.isArray(ds.columns) || !Array.isArray(ds.rows)) throw new Error(`Union source ${i + 1} is not a dataset`);
    });

    // column key order = first dataset, then new keys in appearance order
    const order = [];
    const seen = new Set();
    const metaByKey = new Map();       // key -> representative column meta (first seen)
    const typesByKey = new Map();      // key -> [types across datasets]
    datasets.forEach((ds) => ds.columns.forEach((col) => {
      if (!seen.has(col.key)) { seen.add(col.key); order.push(col.key); metaByKey.set(col.key, col); }
      if (!typesByKey.has(col.key)) typesByKey.set(col.key, []);
      typesByKey.get(col.key).push(col.type);
    }));

    const columns = order.map((key) => {
      const rep = metaByKey.get(key);
      const type = promoteType(typesByKey.get(key));
      return {
        key, label: rep.label || key, type, role: roleFor(type, rep.role),
        agg: (type === "integer" || type === "float") ? (rep.agg || "sum") : null,
        unit: rep.unit || null, fmt: rep.fmt || null,
      };
    });
    if (options.addSource) columns.push({ key: "__source", label: "__source", type: "category", role: "dimension", agg: null, unit: null, fmt: null });

    const sourceCounts = {};
    const rows = [];
    datasets.forEach((ds) => {
      const label = ds.short || ds.id;
      sourceCounts[label] = ds.rows.length;
      ds.rows.forEach((src) => {
        const row = {};
        order.forEach((key) => { row[key] = key in src && !isBlank(src[key]) ? src[key] : null; });
        if (options.addSource) row.__source = label;
        rows.push(row);
      });
    });

    return {
      op: "union", columns, rows,
      lineage: { op: "union", sourceIds: datasets.map((d) => d.id), createdAt: options.createdAt || null },
      sourceCounts,
    };
  }

  // ── JOIN ────────────────────────────────────────────────────────────
  // left,right: dataset. options: { type:'inner'|'left'|'right'|'full', keyPairs:[{left,right}], createdAt? }
  function normKey(value) {
    if (isBlank(value)) return null;                 // null keys never match
    if (typeof value === "number") return Number.isFinite(value) ? "n:" + value : null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : "d:" + value.toISOString();
    const s = String(value).trim();
    if (s === "") return null;
    if (/^[+-]?\d+(?:\.\d+)?$/.test(s)) return "n:" + Number(s);
    if (/^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/.test(s) && !isNaN(Date.parse(s))) return "d:" + new Date(s).toISOString();
    return "s:" + s;
  }

  function compositeKey(row, keys) {
    const parts = [];
    for (const k of keys) {
      const nk = normKey(row[k]);
      if (nk === null) return null;                  // any null part → no match
      parts.push(nk);
    }
    return parts.join("");
  }

  function join(left, right, options) {
    options = options || {};
    const type = options.type || "inner";
    if (!["inner", "left", "right", "full"].includes(type)) throw new Error("Unknown join type: " + type);
    if (!left || !right || !Array.isArray(left.columns) || !Array.isArray(right.columns)) throw new Error("Join requires two datasets");
    const keyPairs = options.keyPairs;
    if (!Array.isArray(keyPairs) || !keyPairs.length) throw new Error("Join requires at least one key pair");
    keyPairs.forEach((p) => { if (!p || !p.left || !p.right) throw new Error("Each key pair needs left and right keys"); });

    const leftKeys = keyPairs.map((p) => p.left);
    const rightKeys = keyPairs.map((p) => p.right);
    const rightShort = right.short || right.id || "right";

    // output columns: all left columns + right columns except join keys; collisions renamed
    const leftKeySet = new Set(leftKeys);
    const rightKeySet = new Set(rightKeys);
    const leftColKeys = new Set(left.columns.map((c) => c.key));
    const columns = [];
    const rightRename = {}; // right original key -> output key
    left.columns.forEach((c) => columns.push({ ...c }));
    right.columns.forEach((c) => {
      if (rightKeySet.has(c.key)) return;            // join key already represented by left
      let outKey = c.key;
      if (leftColKeys.has(c.key)) outKey = `${rightShort}__${c.key}`;
      rightRename[c.key] = outKey;
      columns.push({ ...c, key: outKey, label: c.label && leftColKeys.has(c.key) ? `${rightShort}·${c.label}` : c.label });
    });

    // index right by composite key
    const rightIndex = new Map();
    right.rows.forEach((r) => {
      const ck = compositeKey(r, rightKeys);
      if (ck === null) return;
      if (!rightIndex.has(ck)) rightIndex.set(ck, []);
      rightIndex.get(ck).push(r);
    });
    // detect many-to-many: keys with >1 on both sides
    const leftKeyCounts = new Map();
    left.rows.forEach((r) => { const ck = compositeKey(r, leftKeys); if (ck !== null) leftKeyCounts.set(ck, (leftKeyCounts.get(ck) || 0) + 1); });
    let manyToMany = false;
    for (const [ck, n] of leftKeyCounts) { if (n > 1 && (rightIndex.get(ck) || []).length > 1) { manyToMany = true; break; } }

    const rightColsOut = right.columns.filter((c) => !rightKeySet.has(c.key));
    const emptyLeft = () => { const o = {}; left.columns.forEach((c) => { o[c.key] = null; }); return o; };
    const fillRight = (o, r) => { rightColsOut.forEach((c) => { o[rightRename[c.key]] = r ? (isBlank(r[c.key]) ? null : r[c.key]) : null; }); };

    const rows = [];
    const matchedRightKeys = new Set();
    let leftUnmatched = 0;
    left.rows.forEach((lr) => {
      const ck = compositeKey(lr, leftKeys);
      const matches = ck === null ? [] : (rightIndex.get(ck) || []);
      if (matches.length) {
        matchedRightKeys.add(ck);
        matches.forEach((rr) => {
          const o = {};
          left.columns.forEach((c) => { o[c.key] = isBlank(lr[c.key]) ? null : lr[c.key]; });
          fillRight(o, rr);
          rows.push(o);
        });
      } else {
        leftUnmatched++;
        if (type === "left" || type === "full") {
          const o = {};
          left.columns.forEach((c) => { o[c.key] = isBlank(lr[c.key]) ? null : lr[c.key]; });
          fillRight(o, null);
          rows.push(o);
        }
      }
    });

    // right-only rows for right/full joins
    let rightUnmatched = 0;
    if (type === "right" || type === "full") {
      right.rows.forEach((rr) => {
        const ck = compositeKey(rr, rightKeys);
        if (ck === null || !matchedRightKeys.has(ck)) {
          rightUnmatched++;
          const o = emptyLeft();
          // map right join key values onto the left join key columns
          keyPairs.forEach((p) => { o[p.left] = isBlank(rr[p.right]) ? null : rr[p.right]; });
          fillRight(o, rr);
          rows.push(o);
        }
      });
    }

    return {
      op: "join", columns, rows,
      lineage: { op: "join", joinType: type, sourceIds: [left.id, right.id], keyPairs, createdAt: options.createdAt || null },
      stats: { outputRows: rows.length, leftRows: left.rows.length, rightRows: right.rows.length, leftUnmatched, rightUnmatched, manyToMany },
    };
  }

  // ── preview + toDataset ────────────────────────────────────────────
  function preview(result, n) {
    if (!result || !Array.isArray(result.rows)) throw new Error("preview requires a combine result");
    return result.rows.slice(0, n || 100);
  }

  function safeSlug(value) {
    return String(value || "combined").normalize("NFKC").replace(/[^a-zA-Z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "combined";
  }

  // Build a full dataset object (pure — caller registers it via Store.actions.registerDataset)
  function toDataset(result, meta) {
    meta = meta || {};
    if (!result || !Array.isArray(result.rows) || !Array.isArray(result.columns)) throw new Error("toDataset requires a combine result");
    const short = meta.short || meta.name || (result.op === "join" ? "joined" : "combined");
    const id = meta.id || `combine_${safeSlug(short)}`;
    return {
      id, name: meta.name || `${short}.csv`, short, icon: "table",
      source: result.op === "join" ? "Join" : "Union",
      rows: result.rows, columns: result.columns,
      lineage: result.lineage,
    };
  }

  const api = { union, join, preview, toDataset, promoteType, normKey };
  if (typeof window !== "undefined") window.DataOps = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
