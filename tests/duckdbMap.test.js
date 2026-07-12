const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const M = require(path.join(__dirname, "..", "js", "duckdbMap.js"));

test("arrowTypeToApp maps Arrow types to app column types", () => {
  assert.equal(M.arrowTypeToApp("Int32"), "integer");
  assert.equal(M.arrowTypeToApp("Int64"), "integer");
  assert.equal(M.arrowTypeToApp("Uint16"), "integer");
  assert.equal(M.arrowTypeToApp("Float64"), "float");
  assert.equal(M.arrowTypeToApp("Decimal[38,9]"), "float");
  assert.equal(M.arrowTypeToApp("Bool"), "boolean");
  assert.equal(M.arrowTypeToApp("Utf8"), "string");
  assert.equal(M.arrowTypeToApp("LargeUtf8"), "string");
  assert.equal(M.arrowTypeToApp("Date32<DAY>"), "datetime");
  assert.equal(M.arrowTypeToApp("Timestamp<MICROSECOND>"), "datetime");
  assert.equal(M.arrowTypeToApp("Time64<NANOSECOND>"), "datetime");
  assert.equal(M.arrowTypeToApp(undefined), "string"); // fallback
});

test("coerceCell converts BigInt→Number and Date→ISO, leaves others", () => {
  assert.equal(M.coerceCell(42n), 42);
  assert.strictEqual(typeof M.coerceCell(42n), "number");
  assert.equal(M.coerceCell(new Date("2026-06-01T00:00:00Z")), "2026-06-01T00:00:00.000Z");
  assert.equal(M.coerceCell("hi"), "hi");
  assert.equal(M.coerceCell(3.14), 3.14);
  assert.equal(M.coerceCell(null), null);
});

test("columnsFromArrow builds app column meta with roles", () => {
  const cols = M.columnsFromArrow([{ name: "n", type: "Int32" }, { name: "s", type: "Utf8" }]);
  assert.deepEqual(cols[0], { key: "n", label: "n", type: "integer", role: "measure" });
  assert.deepEqual(cols[1], { key: "s", label: "s", type: "string", role: "dimension" });
});

test("arrowToResult converts a mock Arrow table to {columns, rows} with coercion", () => {
  const mockTable = {
    schema: { fields: [{ name: "answer", type: "Int64" }, { name: "s", type: "Utf8" }] },
    toArray: () => [{ toJSON: () => ({ answer: 42n, s: "hi" }) }],
  };
  const r = M.arrowToResult(mockTable);
  assert.equal(r.columns[0].type, "integer");
  assert.equal(r.rows[0].answer, 42);           // BigInt coerced
  assert.strictEqual(typeof r.rows[0].answer, "number");
  assert.equal(r.rows[0].s, "hi");
});

test("decimalToNumber reconstructs Arrow Decimal128 word arrays with scale", () => {
  assert.equal(M.decimalToNumber({ 0: 35, 1: 0, 2: 0, 3: 0 }, 1), 3.5);   // the real DuckDB '3.5' shape
  assert.equal(M.decimalToNumber([12345, 0, 0, 0], 2), 123.45);
  assert.equal(M.decimalToNumber({ 0: 0, 1: 0, 2: 0, 3: 0 }, 2), 0);
  assert.equal(M.decimalToNumber(42n, 0), 42);
  assert.equal(M.decimalToNumber(3.5, 1), 3.5); // already a number → passthrough
  assert.equal(M.decimalToNumber(null, 2), null);
  // negative (two's complement): -1 * 10^-0 word array is all-ones
  assert.equal(M.decimalToNumber([0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF], 0), -1);
});

test("decimalScale reads field.type.scale or parses the type string", () => {
  assert.equal(M.decimalScale({ type: { scale: 4 } }), 4);
  assert.equal(M.decimalScale({ type: "Decimal[38,9]" }), 9);
  assert.equal(M.decimalScale({ type: "Utf8" }), 0);
});

test("formatTemporal renders epoch-ms as readable date/datetime strings", () => {
  const ms = 1704153600000; // 2024-01-02T00:00:00Z
  assert.equal(M.formatTemporal(ms, true), "2024-01-02");            // DATE → date only
  assert.equal(M.formatTemporal(ms, false), "2024-01-02 00:00:00");  // TIMESTAMP → datetime
  assert.equal(M.formatTemporal(BigInt(ms), true), "2024-01-02");    // bigint ms
  assert.equal(M.formatTemporal(new Date(ms), true), "2024-01-02");  // Date instance
  assert.equal(M.formatTemporal(null, true), null);
  assert.equal(M.formatTemporal("already-a-string", true), "already-a-string"); // leave non-numeric
});

test("arrowToResult formats a Date32 column as YYYY-MM-DD, not a raw number", () => {
  const mock = {
    schema: { fields: [{ name: "date", type: "Date32<DAY>" }, { name: "ts", type: "Timestamp<MICROSECOND>" }] },
    toArray: () => [{ toJSON: () => ({ date: 1704153600000, ts: 1704153600000 }) }],
  };
  const r = M.arrowToResult(mock);
  assert.equal(r.columns[0].type, "datetime");
  assert.equal(r.rows[0].date, "2024-01-02");
  assert.equal(r.rows[0].ts, "2024-01-02 00:00:00");
});

test("arrowToResult decodes a Decimal column to a plain number", () => {
  const mock = {
    schema: { fields: [{ name: "avg", type: "Decimal[10,2]" }] },
    toArray: () => [{ toJSON: () => ({ avg: { 0: 12345, 1: 0, 2: 0, 3: 0 } }) }],
  };
  const r = M.arrowToResult(mock);
  assert.equal(r.columns[0].type, "float");
  assert.equal(r.rows[0].avg, 123.45);
});

test("sanitizeTableName strips quotes/whitespace, preserves Korean, falls back", () => {
  assert.equal(M.sanitizeTableName("seoul_txns"), "seoul_txns");
  assert.equal(M.sanitizeTableName("강남 아파트"), "강남_아파트");   // Korean preserved, space→_
  assert.equal(M.sanitizeTableName('bad"name`x'), "badnamex");     // quotes/backticks removed
  assert.equal(M.sanitizeTableName("  spaced  out  "), "spaced_out");
  assert.equal(M.sanitizeTableName(""), "table");
  assert.equal(M.sanitizeTableName(null), "table");
});
