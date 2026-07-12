// duckdbMap.js — pure helpers for the DuckDB-WASM adapter (dual-mode: window.DuckDBMap + Node require).
// Maps Apache Arrow result types to the app's column types, coerces Arrow/JS cell values into
// plain JSON-safe values (BigInt→Number, Date→ISO), and sanitizes dataset names into table names.
// Kept pure & Node-tested because the browser-only DuckDB engine can't run under `node --test`.
(function () {
  "use strict";

  // Arrow field type (via String(field.type), e.g. "Int32", "Utf8", "Timestamp<MICROSECOND>",
  // "Decimal[38,9]", "Date32<DAY>", "Bool") → app column type.
  function arrowTypeToApp(typeStr) {
    const t = String(typeStr || "");
    if (/^Bool/i.test(t)) return "boolean";
    if (/^(Float|Decimal|Half)/i.test(t)) return "float";
    if (/^(Int|Uint)/i.test(t)) return "integer";
    if (/^(Date|Timestamp|Time)/i.test(t)) return "datetime";
    // Utf8 / LargeUtf8 / everything else → string
    return "string";
  }

  // Coerce a single cell value (from Arrow row.toJSON()) into a JSON-safe app value.
  function coerceCell(v) {
    if (typeof v === "bigint") return Number(v);
    if (v instanceof Date) return v.toISOString();
    return v;
  }

  // Arrow Decimal128 comes through row.toJSON() as a 4×uint32 little-endian, two's-complement
  // word array/object (e.g. {0:35,1:0,2:0,3:0}). Reconstruct the scaled number using the column's
  // scale (DuckDB types literals/aggregates like AVG as DECIMAL, so this is common).
  function decimalToNumber(words, scale) {
    if (words == null) return null;
    if (typeof words === "number") return words;
    if (typeof words === "bigint") return Number(words) / Math.pow(10, scale || 0);
    const w = [0, 1, 2, 3].map((i) => BigInt((words[i] >>> 0) || 0));
    let big = w[0] | (w[1] << 32n) | (w[2] << 64n) | (w[3] << 96n);
    if (w[3] & 0x80000000n) big -= (1n << 128n); // negative (two's complement)
    return Number(big) / Math.pow(10, scale || 0);
  }

  // Scale for a Decimal field: prefer numeric field.type.scale, else parse "Decimal[p,s]"/"Decimal<..,s>".
  function decimalScale(field) {
    if (field && field.type && typeof field.type.scale === "number") return field.type.scale;
    const m = /Decimal[\[<][^,]*,\s*(\d+)/i.exec(String(field && field.type));
    return m ? Number(m[1]) : 0;
  }

  // Build the app column meta list from Arrow schema fields.
  function columnsFromArrow(fields) {
    return (fields || []).map((f) => {
      const type = arrowTypeToApp(f.type);
      return { key: f.name, label: f.name, type, role: (type === "integer" || type === "float") ? "measure" : "dimension" };
    });
  }

  // Turn a full Arrow result into the app's { columns, rows } shape.
  // `table` is an Arrow Table (has schema.fields and toArray()); rows are plain objects.
  function arrowToResult(table) {
    const fields = table.schema.fields;
    const columns = columnsFromArrow(fields);
    // precompute decimal columns → scale (need the schema, not just the cell value)
    const decScale = {};
    for (const f of fields) if (/^Decimal/i.test(String(f.type))) decScale[f.name] = decimalScale(f);
    const rows = table.toArray().map((r) => {
      const o = r.toJSON();
      for (const k in o) o[k] = (k in decScale) ? decimalToNumber(o[k], decScale[k]) : coerceCell(o[k]);
      return o;
    });
    return { columns, rows };
  }

  // Sanitize a dataset short/id into a table name. DuckDB identifiers are quoted by the adapter,
  // so we only strip characters that would break a quoted identifier (double-quotes, control chars)
  // and collapse whitespace; Korean and other letters are preserved. Empty → "table".
  function sanitizeTableName(name) {
    let s = String(name == null ? "" : name).replace(/["`\r\n\t]/g, "").replace(/\s+/g, "_").trim();
    s = s.replace(/^_+|_+$/g, "");
    return s || "table";
  }

  const api = { arrowTypeToApp, coerceCell, decimalToNumber, decimalScale, columnsFromArrow, arrowToResult, sanitizeTableName };
  if (typeof window !== "undefined") window.DuckDBMap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
