const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { dashMeasures, dashDims, defaultWidgets, colExists, widgetStale } =
  require(path.join(__dirname, "..", "js", "dashWidgets.js"));

// 3 measures + 2 dims (subway-like)
const subway = [
  { key: "노선명", label: "노선명", type: "string", role: "dimension" },
  { key: "역명", label: "역명", type: "string", role: "dimension" },
  { key: "승차총승객수", label: "승차총승객수", type: "integer", role: "measure" },
  { key: "하차총승객수", label: "하차총승객수", type: "integer", role: "measure" },
  { key: "요금", label: "요금", type: "float", role: "measure" },
];

test("dashMeasures / dashDims classify by role and type", () => {
  assert.deepEqual(dashMeasures(subway).map((c) => c.key), ["승차총승객수", "하차총승객수", "요금"]);
  assert.deepEqual(dashDims(subway).map((c) => c.key), ["노선명", "역명"]);
});

test("defaultWidgets builds a varied starter dashboard (no hardcoded fields)", () => {
  const ws = defaultWidgets(subway);
  const types = ws.map((w) => w.spec.chartType).filter(Boolean);
  // varied chart types present
  for (const t of ["bar", "scatter", "treemap", "hbar"]) assert.ok(types.includes(t), `expected ${t}`);
  // KPIs with varied aggs
  const kpis = ws.filter((w) => w.type === "kpi");
  assert.ok(kpis.length >= 3);
  const aggs = new Set(kpis.map((k) => k.spec.agg));
  assert.ok(aggs.has("count") && aggs.has("sum"));
  // every referenced column exists → no widget stale on its own dataset
  assert.equal(ws.filter((w) => widgetStale(w, subway)).length, 0);
  // no leaked hardcoded field names
  assert.ok(!/price_manwon|area_m2|아파트/.test(JSON.stringify(ws)));
});

test("defaultWidgets includes a time-series line when a datetime column exists", () => {
  const withDate = subway.concat([{ key: "월", label: "월", type: "datetime", role: "dimension" }]);
  const ws = defaultWidgets(withDate);
  assert.ok(ws.some((w) => w.spec.chartType === "line"));
});

test("defaultWidgets returns a guidance text widget when no measures and no dims", () => {
  const ws = defaultWidgets([{ key: "id", label: "id", type: "datetime", role: "dimension" }]);
  // datetime-only: no measures, no category/string dims -> note widget
  assert.equal(ws.length, 1);
  assert.equal(ws[0].type, "text");
});

test("widgetStale detects references to missing columns", () => {
  const staleChart = { type: "chart", spec: { cols: ["gone"], measures: [["승차총승객수", "avg"]] } };
  assert.equal(widgetStale(staleChart, subway), true);
  const okChart = { type: "chart", spec: { cols: ["노선명"], measures: [["승차총승객수", "avg"]] } };
  assert.equal(widgetStale(okChart, subway), false);
});

test("widgetStale: count KPI is never stale even without a valid measure", () => {
  const countKpi = { type: "kpi", spec: { measure: "gone", agg: "count" } };
  assert.equal(widgetStale(countKpi, subway), false);
  const sumKpi = { type: "kpi", spec: { measure: "gone", agg: "sum" } };
  assert.equal(widgetStale(sumKpi, subway), true);
});

test("colExists guards null/empty keys", () => {
  assert.equal(colExists(subway, "요금"), true);
  assert.equal(colExists(subway, ""), false);
  assert.equal(colExists(subway, null), false);
});

test("defaultWidgets does not crash on empty columns", () => {
  const ws = defaultWidgets([]);
  assert.equal(ws.length, 1);
  assert.equal(ws[0].type, "text");
});
